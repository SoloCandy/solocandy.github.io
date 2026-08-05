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
suspension-lever-rate) and converted from N/m to lb/in via
`LB_IN_TO_NM = 175.126790921` (the constant is N/m per lb/in, despite the name).

Springs are the one output that was never click-based, which is why the
physical-unit game mode below needs no change to this solve at all — only the
display conversion differs.

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

## Physical-unit output (`beamng` game mode)

Both Forza modes express springs, dampers and ARBs as abstract "clicks" on a
fixed `1..N` scale, because Forza hides its real internal units — that is what
`DAMPING_CALIBRATION` and `ARB_RS_SCALE` exist to bridge. BeamNG builds its
tuning sliders per-vehicle from the car's Jbeam `variables` block, so there is
no universal scale to calibrate against and inventing a third click range would
mean inventing a constant with nothing to validate it.

Instead `GAME_LIMITS.beamng = {damping:null, arb:null, physical:true}` marks a
mode that **skips the click-compression step** and emits what the solver already
works in. `computeTune` branches on `isPhysical(gameMode)`, never on the mode
name, so a future physical-unit game costs one `GAME_LIMITS` entry.

**Units are taken from BeamNG's own tuning sliders**, verified against a screenshot
of a stock vehicle's defaults. They are not the most conventional SI spellings and
must not be "tidied":

| Output | Forza | BeamNG slider | Bridge |
|---|---|---|---|
| Spring Rate | lb/in | **N/m** (*not* N/mm — a 1000× error) | the solve is identical; `LB_IN_TO_NM` is already N/m per lb/in |
| Bump/Rebound Damping | 1..`lim.damping` clicks | **N/m/s** (≡ N·s/m) | `solveDampRaw`'s `calib` argument: `DAMPING_CALIBRATION` or `1` |
| Anti-Roll Spring Rate | 1..`lim.arb` clicks | **N/m**, a *linear* rate | `clk()` skipped, then `k = 2·rs/track²` at the display layer |

`cc = 2·√(wr·mass)` has units kg/s ≡ N·s/m, so `cc·(ζ/100)` is a genuine damping
coefficient — the same quantity BeamNG's damping variables hold. No new empirical
constant is introduced anywhere in this path.

Note the ARB conversion changes *kind*, not just scale: the solver's currency is
torsional roll stiffness (N·m/rad) while BeamNG asks for a linear rate. The
inversion of `rs = k·track²/2` is the same relationship the spring side already
uses. `fe.arbMan{F,R}` is always **stored** as roll stiffness; the N/m a user sees
and types in a physical mode is converted at the field boundary only, so the
game-mode migration effect and `computeTune` both stay in one unit.

### Motion ratio

Forza's tuning screen displays **wheel rate**, which is what `solveSpring` produces
(`mr` is always 1 at its call sites). BeamNG's sliders act at the **spring and
damper**, so an inboard spring must be stiffer by `1/mr²` to give the same wheel
rate. `ch.motionRatioF`/`motionRatioR` (PRO CHASSIS, physical modes only, default
1.0) apply that correction.

It is applied **at the display layer and deliberately not in `computeTune`**. Hz,
roll stiffness, mech balance and every handling-balance figure are wheel-rate
quantities and must not move when a motion ratio is entered — only the number you
type into the game changes. `tests-beamng.js` asserts that invariant directly.

BeamNG does not expose motion ratio, and it differs per vehicle *and* per axle, so
it cannot be derived — only entered. Left at 1.0 the output is the wheel rate.

Three consequences worth knowing:

- **Nothing is clamped, floored, or quantised.** `dampScale` has *two* branches
  (it scales up when the softer damper falls below 1 click, not only down at the
  ceiling); both are bypassed, as is `clampDamp`'s 0.1 rounding.
- **Balance figures differ slightly from Forza for identical inputs.** Forza
  deliberately recomputes `rsAbF`/`rsAbR` back out of the *rounded, clamped*
  click values, so the balance bar reflects what the game will really do with the
  numbers you type. Physical modes have no quantisation to model, so the ARB
  budget flows through untouched. This is correct, not drift.
- **BASIC ARB stiffness is unavailable.** Its budget is defined as a percentage
  of the click ceiling (`1 + (lim.arb-1)·pct/100`), so it has no meaning without
  one. AUTO, ROLL ° and SHARE % are unaffected.

CO-SOLVE's Auto Spring Share normalises spring and ARB utilisation against
`lim.arb`. Because the same denominator divides *both* sides of its comparison,
it cancels — physical modes substitute a nominal `ARB_UTIL_REF = 65` and reach
the identical `S`. The one place it does not cancel is the `Math.min(1, …)`
saturation on the spring side, which is why the constant is pinned to Horizon's
value rather than being arbitrary. `tests-beamng.js` asserts the equivalence
across a 21-point Mech Balance Target sweep.

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

  **Auto Spring Share** (`fe.springShareAuto`, the default) picks `S`
  itself instead of taking it from the slider: `computeTune` binary-searches
  `S ∈ [0,1]` for the point where spring utilisation equals ARB utilisation.
  Both are expressed in the same currency so the comparison is meaningful —
  spring utilisation is the incremental rear roll-stiffness the spring
  correction is carrying (relative to its `S=0` baseline), converted through
  the same `ARB_RS_SCALE·track²` relationship real ARB clicks use, then
  scaled 0..1 against `lim.arb`: "how many ARB clicks would this same
  physical correction have cost, had bars done it instead." ARB utilisation
  is simply the heavier bar's clicks against `lim.arb`. Whichever side is
  cheaper for a given `S` absorbs more of the correction, and the search
  converges on the split where neither is disproportionately stressed. A
  prior version compared Hz distance against the game's Hz range instead —
  see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for why that mismatch left AUTO
  pinned at 100% spring / 0% ARB in almost every real case.

  Note that only spring Hz feeds the RESPONSE/transient breakdown
  (`responseFactors` — Hz F and Hz R together are 55% of that score); ARB
  clicks feed only the steady-state balance bar (`bAb`). So for the same
  target, more of the correction landing on springs vs ARBs changes how much
  the fix also shifts PLANTED↔REACTIVE character as a side effect, not just
  which numbers move.

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
