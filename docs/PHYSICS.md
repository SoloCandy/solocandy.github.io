# SUSP.OS — Hz, Spring, and Damping Formulas

The core physics engine: how a ride-stiffness slider position becomes a
spring rate in lb/in, how a damping ratio becomes a damper click count, and
how the various rear-Hz modes (FLAT RIDE / MULTIPLIER / MECH / CO-SOLVE /
INDEPENDENT) derive the secondary axle's frequency. Scope note: this file
covers the *solve* math (Hz → physical output). For the separate *balance
direction* math (which axle being stiffer means oversteer vs understeer),
see [FORMULAS.md](FORMULAS.md). For camber/toe/caster, see
[ALIGNMENT.md](ALIGNMENT.md).

---

## Ride Stiffness slider ↔ Hz

```js
HZ_MIN = 0.8, HZ_MAX = 5.5                          // the whole app's spring-frequency band
rsToHz = rs => rs > 6 ? 0.8 + (rs/100)*2.7 : rs      // migrates old 0-100 integer saves to Hz
hzToRs = hz => clamp(HZ_MIN, HZ_MAX, hz)             // rounds/clamps a raw Hz value back into range
```

`fe.rideStiffness` stores Hz directly today; the `rs>6` branch in `rsToHz`
exists only to auto-migrate pre-Hz saves/share-codes that stored an
integer 0-100 slider position instead.

## Spring rate (`solveSpring`)

```js
solveSpring(hz, mass, mr) = (hz*2π)² * mass / mr² / LB_IN_TO_NM
```

Standard `k = m·ωₙ²` spring-rate-from-natural-frequency relationship
(`ωₙ = hz*2π`), divided by motion ratio squared (`mr` — always `1` in this
app's calls, since Forza's displayed spring rate is wheel-rate, not
suspension-lever-rate) and converted from N/mm to lb/in via
`LB_IN_TO_NM = 175.126790921`.

## Damper clicks (`solveDampRaw` + `computeTune`'s `clampDamp`)

```js
criticalDamping(hz, mass) = 2 * sqrt((hz*2π)² * mass * mass)   // cc, the ζ=100% reference
solveDampRaw(hz, mass, z) = criticalDamping(hz, mass) * (z/100) * DAMPING_CALIBRATION
```

`z` is the damping ratio (ζ) as a 0-115% value (>100% = overdamped, allowed
because some Forza dampers support it). `DAMPING_CALIBRATION = 0.00135` is
the empirically-validated N/mm/s → lbf/ft/s conversion (see README's
Calibration table).

`solveDampRaw` is deliberately unclamped. `computeTune` solves all four
values from it, then scales front and rear together (`dampScale`) so the
pair fits the game's click limit without losing their ratio, and only then
applies the `1..lim` bound per value (`clampDamp`). Clamping before scaling
would distort the front/rear relationship, which is why there is no
clamping single-value helper — a `solveDamp` that did its own clamp existed
once but had no callers left and was removed. `tests.js` still mirrors that
older shape; see the note above its copy there.

## Settle time ↔ ζ (`settleZetas`)

```js
settleZetas(rideRef, fHz, rHz, refZeta, biasMult):
  rideRef==='rear':   zR = refZeta;               zF = refZeta * (rHz/fHz) / biasMult
  rideRef==='shared':  avg=(fHz+rHz)/2; b=sqrt(biasMult)
                       zF = refZeta * (avg/fHz) / b;  zR = refZeta * (avg/rHz) * b
  rideRef==='front' (default): zF = refZeta;      zR = refZeta * (fHz/rHz) * biasMult
```

The reference axle (whichever the Ride Stiffness slider anchors) holds
`refZeta` exactly; the other axle's ζ is derived so both axles reach their
settle time at the same moment (`ζ·Hz` held constant between them), then
skewed by `biasMult = 2^(settleBias/50)` — `settleBias>0` makes the rear
settle faster regardless of which axle is the reference.

## Rear/secondary Hz modes

`fe.rearHzMode` picks which of these derives the non-anchored axle's
frequency (dispatch lives in `feelToPhysics`):

- **FLAT RIDE** (`flatRideRearHz` / `flatRideSharedHz`)
  — solves the rear (or, in `shared` ride-ref mode, both axles from an
  average) so front and rear wheels hit the same bump in phase at the
  target speed, cancelling pitch. `flatRideSharedHz` inverts the same
  relationship as a quadratic to solve for `fHz` when the slider represents
  the *average* of both axles rather than the front alone. Disabled above
  200mph (returns front Hz unchanged) and falls back to `fHz*1.2` near
  0mph, where the flat-ride relationship becomes numerically unstable.
- **MULTIPLIER** — `rearHz = frontHz * fe.rearHzMult` (or the inverse
  split for `shared` ride-ref) — a fixed ratio, no chassis math involved.
- **INDEPENDENT** — `fe.rearHzMan` used directly, fully decoupled.
- **MECH** (PRO only) — solves the secondary axle's Hz so that, combined
  with whatever ARB balance mode is active (WEIGHT/ROLL/SHARE/MANUAL each
  contribute a different ARB roll-stiffness fraction that dilutes the
  spring-only correction), the resulting roll-stiffness rear fraction hits
  `resolveArbBalTarget`'s target exactly. This is the most complex branch
  in the file — conceptually it's "given the ARB's
  fixed contribution, what spring Hz ratio makes springs+ARBs sum to the
  target," solved differently depending on whether the ARB budget is a
  roll-stiffness fraction (WEIGHT/SHARE) or an absolute value (ROLL/MANUAL,
  the latter solved via a quadratic in `mult_man`).
- **CO-SOLVE** (PRO only — the branch in `feelToPhysics`, plus the main
  solve in `computeTune`) — solves rear Hz *and* ARB split together, with
  `fe.springShare` controlling how much of the balance correction comes
  from springs vs ARBs. `Kcs = rHz/fHz` is derived once from the chassis,
  target, and spring share, then the ride-reference axle's slider is
  inverted through `Kcs` so the *other* axle's Hz stays correct regardless
  of which axle the user chose to anchor.

## Mech balance grip model (`mechBalanceLLT`/`balanceFromRsBal`)

```js
mechBalanceLLT(ch, Kf, Kr):
  sF = Kf/(Kf+Kr)                                          // front's share of roll stiffness
  dWf, dWr = lateral load transfer per axle (elastic + geometric terms, via cornerMasses/rollCenterHeight)
  fy(Fz) = Fz * max(0, 1 - TIRE_LOAD_SENS*(Fz/FzRef - 1))  // tyre grip falls off as load rises above reference
  FyF, FyR = combined outer+inner grip per axle, scaled by tyre width^WIDTH_GRIP_EXP
  return clamp(0, 1, 0.5 + MECH_BAL_GAIN*(FyF/(Mf*g) - FyR/(Mr*g)))
```

This is the *physical at-limit* grip balance (0.5 = neutral, >0.5 =
oversteer-prone), derived from lateral load transfer distribution — a
different model from the roll-stiffness-ratio-based `natMechBalance`
Forza itself displays. `balanceFromRsBal(ch, rsBal)` is the inverse-facing
helper: converts a roll-stiffness rear fraction into the equivalent
`Kf/Kr` ratio and runs it through the same LLT model, used wherever the
UI needs "what grip balance would this roll-stiffness split produce."
`TIRE_LOAD_SENS`, `MECH_BAL_GAIN`, `WIDTH_GRIP_EXP` are in README's
Calibration table.

---

## Natural sag and bottoming risk (ride-height CHASSIS toggle)

```js
sag_mm = 9810 / (2π * hz)²   // per axle, using tune.fHz / tune.rHz
```

Static suspension compression under the car's own weight is a direct
function of natural frequency alone — mass cancels out of the classic
`f = (1/2π)√(g/δ)` relation, leaving `δ = g/(2πf)²`. Softer springs (lower
Hz) sag more; no separate spring-rate solve is needed since `solveSpring`
already folds mass into Hz. Since compression scales linearly with vertical
wheel load (mass cancels out the same way at any load factor, not just 1g),
sag at load factor `n` is simply `n × sag_1g` — a straight line through the
origin. This feeds the CHASSIS section's SAG vs LOAD chart (PRO mode, RIDE
HEIGHT → CG toggle): an inline SVG plotting each axle's compression line
against load (g) on the x-axis, with a dashed reference line at that axle's
entered ride height — where the diagonal crosses the dashed line is the
load (in g) at which that axle bottoms out, also given as a plain number
and an at-a-glance LOW/MED/HIGH/BOTTOMED badge (`sag_1g/rideHeight`: <0.5
LOW, <0.8 MED, <1.0 HIGH, ≥1.0 BOTTOMED AT REST). This is intentionally
static-only — it does not include dynamic load transfer from cornering,
braking, or bumps (the LOAD TRANSFER readout
elsewhere estimates that separately, at 1g) — so treat HIGH/BOTTOMED as a
prompt to double-check, not a certainty. See README's Calibration section
and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the same caveat as it applies to
the CG-height estimate this toggle also drives.

---

## Test coverage

**`tests.js` does not import, read, or evaluate `index.html`.** It is a
hand-maintained *duplicate* of the physics functions, re-declared inside the
test file. It will pass unchanged even if `index.html` is deleted outright,
so a green run proves the formulas documented here are self-consistent — it
proves nothing about the app. Any change to a mirrored function has to be
copied across by hand, and drift between the two is silent. There is no CI,
no linter and no build step, so nothing else catches it either.

Given that, the reliable way to verify a change to `index.html` is the
browser: load it, check the console and `#pre-load`, and exercise the
affected tier. See [CODE_MAP.md](CODE_MAP.md) for the runtime bootstrap that
makes compile and runtime failures visible.

`tests.js` mirrors `flatRideRearHz`, `solveSpring`, `solveDamp` (a shape the
app no longer has — see the note above its definition there), `settleZetas`,
and `mechBalanceLLT`/`balanceFromRsBal` (settle-mode ride-reference
anchoring in particular has a dedicated test section, since it was the site
of a prior legacy-formula regression guard). The Hz-mode dispatch inside
`feelToPhysics` (MULTIPLIER/MECH/CO-SOLVE branch selection) is not
separately tested — only the underlying functions each mode calls into.
`computeTune`, the codec, and all React UI have no coverage at all.
