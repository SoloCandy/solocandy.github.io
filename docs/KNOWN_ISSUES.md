# SUSP.OS — Known Issues & Limitations

Real quirks and gaps found during development that are easy to lose track
of without a written trail. Not a general bug tracker — just things that
either can't be trivially fixed, or were fixed here and are worth
remembering *why* they broke in the first place.

## Fixed — MAN ARB stiffness still registered as MECH/CO-SOLVE balance mode enabled (resolved)

Stiffness Mode MAN (direct front/rear ARB clicks) is supposed to bypass the
ARB budget/split solve entirely — `computeTune`'s `arbMode==='man'` branch
does this correctly (`index.html` around the `if(arbMode==='man')` check).
But four separate UI-facing "is a mech/co-solve target active" checks only
looked at `arbBalMode` (`'mech'`/`'coSolve'`), never at `arbMode`, so a
leftover `arbBalMode` of MECH or CO-SOLVE from before switching to MAN kept
the app displaying as if a target were still being solved toward, even
though ARB itself was no longer participating in any solve:

- `chassisAnalysis.hasMechTarget` (drives the BALANCE GUIDE's target marker)
- the BALANCE section's `_hasMechTarget` (shown twice — gates the "Balance
  Target only applies in..." message and the CURRENT/TARGET label)
- `computeTune`'s `mechBalClamped` (drove a "Mech balance target couldn't
  be reached" warning even though nothing was targeting it)
- the Handling Balance widget's `showTgt` (main output panel — showed a
  TGT marker/value even in MAN mode)

Fixed by adding `arbMode!=='man'` to the `arbBalMode==='mech'||'coSolve'`
clause in all four, while preserving the existing `arbMode==='man' &&
rearHzMode==='mech'` case (Hz MECH mode keeps solving spring Hz toward the
target independently of ARB stiffness mode, so that combination correctly
still counts). Verified: MECH balance mode + switching Stiffness Mode to
MAN now correctly falls back to "Balance Target only applies in..." and
drops the TGT marker; switching back to AUTO restores it.

Not touched: the ANTI-ROLL BARS section's MECH/CO-SOLVE "ARB SPLIT"
readout boxes (`(fe.arbBalMode??'weight')==='mech'/'coSolve'` blocks) still
show under MAN — CO-SOLVE's rear-Hz solve genuinely keeps running
independent of `arbMode` (see `computeTune`'s `arbBalMode==='coSolve'`
branch, which isn't gated on `arbMode` at all), so a blanket hide would
wrongly remove the still-functional SPRING SHARE control. Properly
resolving this needs to split "ARB-derived readouts" (stale under MAN)
from "Hz-derived readouts" (still live) rather than one on/off flag —
left as a follow-up, not fixed here.

## Fixed — NEUTRAL+AUTO ARB budget could blow up with ARB Bias + high Rear Multiplier (resolved)

`computeTune`'s NEUTRAL ARB balance mode (AUTO stiffness only) expands
the ARB roll-stiffness budget when the natural AUTO budget is
too small to let the F/R split fully cancel the springs' balance-bar bias.
That expanded budget was computed once, before ARB Bias was applied — but
ARB Bias then shifts the split away from that exact-cancel point anyway. At
a high Rear Multiplier (1.25×+ — springs strongly rear-biased) combined
with ARB Bias pushed to REAR HEAVY, this left both front *and* rear ARB
oversized (a real case hit 63.1/65.0, both effectively maxed) instead of
the moderate values a rear-heavy bias should produce.

Fixed by only running the expansion when ARB Bias is centred (`0`) — the
only case where "reach exact cancellation" is the actual goal. Any nonzero
bias means the user has already opted out of exact cancellation, so the
budget stays at its natural AUTO size. Verified: same car (2.90 Hz front,
1.25× rear multiplier) with ARB Bias at full rear-heavy went from 63.1/65.0
(MAX/MAX) to 18.9/19.7 (LOW/LOW); ARB Bias at 0 is unaffected (still
reaches the springs-cancelling split and still shows "ARB MAXED — CAN'T
FULLY CANCEL" honestly when the game's 65-click limit is a genuine
constraint).

## Fixed — MEASURE NAT BAL calibration was ignored by WEIGHT/NEUTRAL ARB modes (resolved)

The Tune Check "MEASURE NAT BAL" flow lets a PRO user replace the
track-width geometry prediction with an actual in-game Mech Balance
reading (`ch.measuredNatBal`, read via `naturalMechBalanceOf(ch)`). That
calibration only ever reached `resolveArbBalTarget` — the MECH/CO-SOLVE
target and the informational "NATURAL"/"CUR" display — never the ARB
split WEIGHT and NEUTRAL modes actually compute. Both of those read raw
`ch.frontBias` directly (`arbBalance` in `feelToPhysics`, and NEUTRAL's
`nf0` in `computeTune`), completely bypassing the calibration.

Since WEIGHT is the default mode, this meant a user's in-game measurement
had zero effect on their actual tune for anyone not specifically in
MECH/CO-SOLVE. Real case: measured 0.49 in-game, calculator predicted
CUR 0.42 (from the uncalibrated formula), applied tune actually read 0.50
in Forza — an 0.08 gap the calibration was supposed to prevent.

Fixed by adding a new PRO-only Balance Mode, **CHASSIS** (`index.html`
`computeTune`, `arbBalMode==='chassis'` branch) — same split formula as
WEIGHT, but anchored to `naturalMechBalanceOf(ch)` instead of raw
`ch.frontBias`, so it honours a MEASURE NAT BAL reading (or at minimum the
track-width-corrected geometry) instead of the cruder heuristic. WEIGHT
and NEUTRAL themselves were deliberately left unchanged — swapping their
formula would shift ARB output for every BEG/INT tune too, since
`naturalMechBalanceOf`'s fallback is track-width-weighted even at default
geometry, not just weight-fraction. CHASSIS scopes the fix to PRO only.

## Changed — ARB MAN moved from Balance Mode to Stiffness Mode

MAN (direct front/rear ARB click entry) used to live under Balance Mode
(`arbBalMode:'man'`) alongside WEIGHT/NEUTRAL/MECH/CO-SOLVE. It's now a
Stiffness Mode option (`arbMode:'man'`, alongside AUTO/ROLL/SHARE)
instead, since it bypasses the entire budget+split system rather than
choosing a split within a budget — a stiffness-level concept, not a
balance-level one. Selecting Stiffness Mode MAN now hides Balance Mode
entirely (nothing left for it to control).

Old share codes/saves with `arbBalMode:'man'` still load correctly: a
migration in `sanitizeTune` (share-code path) and a matching one-time
`useEffect` in `App()` (persisted-state path) both rewrite it to
`arbBalMode:'weight'` + `arbMode:'man'` on load — see
[CODEC.md](CODEC.md)'s notes on id 41 for the encoding side of this.

## Fixed — MATCH CHASSIS ignored layout polarity for FWD (resolved)

`computeDiff`'s MATCH CHASSIS correction biases
`diffBiasExit`/`diffBiasEntry` toward the Mech Balance Target's gap from
natural balance. The correction was applied with the same sign regardless
of drivetrain layout — but more front-axle lock means *understeer* on a
FWD car, while more rear-axle lock means *oversteer* on RWD/AWD (see
[FORMULAS.md](FORMULAS.md)'s `bDiffAccel`/`bDiffDecel` signs). So on a FWD
car with MATCH CHASSIS on, wanting more oversteer would push the correction
the wrong way — toward more front lock, i.e. more understeer.

Fixed by flipping the correction's sign for `ch.layout==='FWD'` only (RWD/AWD
unaffected — their diff-lock polarity already matches the correction's
assumption). Verified manually: FWD Accel lock reads 17% with MATCH CHASSIS
off (baseline), and correctly *drops* to 13% with it on and a
oversteer-wanting target — previously it would have risen instead.

**Lesson:** any correction/nudge formula that's derived assuming one
drivetrain's polarity needs an explicit per-layout check before being
applied generically. This is the same class of bug as the Damping Bias
hint-text mismatch (see [FORMULAS.md](FORMULAS.md)) — trust the underlying
`bXxx` balance formulas over intuition when wiring up a new correction.

**Not a bug (re-verified after an external report claimed otherwise):**
the EXIT slider's UI code flips the sign of the
stored `dr.diffBiasExit` value for FWD only, so the slider's right side
reads as oversteer-leaning despite FWD's lock-to-balance polarity being
opposite RWD/AWD's. `computeDiff`'s `+effBiasExit*0.15` term for FWD
is *intentionally* the same sign as RWD's — the UI flip
already carries the per-layout inversion, so the formula doesn't need to.
An external review (Gemini) analyzed the formula in isolation, missed the
UI-level flip, and proposed flipping the formula's sign too — which would
double-cancel and silently reintroduce this exact bug. Re-verified live:
FWD EXIT slider at −50 ("PUSH") reads Accel 30%; at +50 ("ROTATION") reads
Accel 15% — correctly less lock on the oversteer-leaning side. Both sites
now cross-reference each other in comments to prevent this specific
misdiagnosis from recurring. (The slider's left/right labels were later
unified to GRIP/ROTATE across all layouts for UI consistency — FWD no
longer shows PUSH/ROTATION specifically — but the underlying sign-flip
logic and this verification are unaffected, since only the label text
changed, not the polarity.)

## Fixed — Test coverage gap: `computeDiff` now covered (resolved)

`tests.js` now includes a `computeDiff` suite: layout-dependent lock/balance
signs for RWD/FWD/AWD, diff type scaling (drift/offroad vs race), SPORT's
decel lockout, MANUAL mode bypassing MATCH CHASSIS, and — critically — a
regression guard for the MATCH CHASSIS FWD-polarity bug above (asserts
"FWD + MATCH CHASSIS + oversteer-wanting target → lower front lock than
baseline, not higher"). This is exactly the test that would have caught
that bug immediately instead of it surviving until manual testing.

## Fixed — Test coverage gap: `computeAlignment` now covered (resolved)

`tests.js` now includes a `computeAlignment` suite: roll/CG-height
compensation, layout-dependent camber gain ordering (FWD least reactive,
RWD most), the front camber clamp floor, toe front/rear lookup-table
sanity, caster's FWD flat reduction and front-bias scaling, and a
regression guard for the Drift/Drag frozen-camber bug above (asserts both
now vary with roll angle instead of staying frozen). Writing these tests
also caught a real error in this file's own toe-front documentation (see
[ALIGNMENT.md](ALIGNMENT.md) — the `(fHz-1.8)×0.010` term's direction was
written backwards; verifying against the formula while writing the test
caught it).

## Open — `bDiffAccel`/`bDiffDecel` don't distinguish accel-lock from decel-lock direction

Per [FORMULAS.md](FORMULAS.md), the Handling Balance model treats *any*
lock magnitude (accel or decel, on whichever axle is driven) as pushing
the same oversteer/understeer direction. Real-world tuning intuition (and
this app's own EXIT/ENTRY slider hint text) treats decel lock as more
nuanced — e.g. "STABLE increases rear decel lock, which *resists*
lift-off oversteer" implies decel lock reduces oversteer risk, not that it
straightforwardly adds to an oversteer number the way accel lock does.

This is a known simplification in the aggregate Handling Balance total,
not a bug — the EXIT/ENTRY sliders' individual labels/directions were
verified against the actual formula and are correct for what they do
locally; it's only the crude "more lock = more of the same total" framing
of the aggregate `bDiffDecel` term that doesn't capture the nuance. Not
fixed here since it would require reworking the aggregate model, which is
out of scope for a documentation pass.

## Open — Handling Balance bar's five contributors aren't on a comparable scale

[FORMULAS.md](FORMULAS.md) documents each contributor's *sign* (oversteer
vs understeer direction) but never claims they're comparable in
*magnitude* — and they aren't. Springs/ARB can swing the bar roughly an
order of magnitude further than diff, brakes, or damping can, even when
those are pushed to their own slider maximums.

`bSp`/`bAb` aren't scaled by an arbitrary constant
at all — they're derived directly from real roll-stiffness shares
(`spShare`/`abShare`), self-normalizing against `rsTotal`. Because Rear
Multiplier (0.50–3.00×) can push the spring-only front/rear split far from
the weight-neutral point, `bSp` alone can reach roughly **±35** at
realistic, in-slider-range settings — worked example: RWD, front weight
52%, `rearHzMult=3.00`, spring share ≈87% → `bSp ≈ (0.52−0.10)×100×0.87 ≈
36.5`. By contrast `bDiffAccel`/`bDiffDecel`/`bBrakeEntry`
are each `<input>% × <weight
fraction> × <flat scale constant>` (`DIFF_BIAS_SCALE=0.14`,
`BRAKE_BIAS_SCALE=0.20`) — maxing the EXIT slider on a RWD Track car tops
out around `bDiffAccel ≈ 3.0`, maxing brake bias around `bBrakeEntry ≈
-3.6`, and `bDampBias` tops out around **±10.7** at Damping Bias's ±50
extreme — a fixed ceiling regardless of the Rebound ζ value the bias is
applied to (the ratio in `bDampBias`'s formula cancels ζ out algebraically).
Diff and brakes are close to invisible on the bar's own scale. Concrete
consequence: `HandlingVerdict`'s dominant-contributor sort
(sorts by `Math.abs(val)`) will pick springs or ARB
as the "dom" contributor almost any time Ride Stiffness/Rear
Multiplier/ARB Bias have been touched at all, even mildly — the actionable
tip can essentially never recommend adjusting diff/brakes unless
spring/ARB sit at *exact* neutral defaults.

Unlike `ARB_RS_SCALE`, `DAMPING_CALIBRATION`, `TIRE_LOAD_SENS`, and
`TIRE_MECH_SCALE` — all tied in the README to SimHub telemetry and Stage 2
testing across three real cars — `DIFF_BIAS_SCALE` and `BRAKE_BIAS_SCALE`
have no documented calibration methodology at all. `tests.js` only asserts
*sign* for `bDiffAccel`/`bDiffDecel`, never magnitude; `BRAKE_BIAS_SCALE`
has zero references anywhere in `tests.js`. Git history confirms neither
constant has ever been empirically recalibrated: `BRAKE_BIAS_SCALE` has
exactly one commit (its introduction, `7932982`); `DIFF_BIAS_SCALE` has
one substantive change (`fdc4361`, 0.12→0.14), and that commit's own
message says the bump "compensates for AWD split-by-center" — a
structural fix for the center-fraction math introduced in that same
commit, not a recalibration against real game behavior.

This scale gap is **not** coordinated with the separately-known issue that
RWD Track's diff accel ceiling (`accelBase`) caps out
well below community-typical lock settings. Git confirms `accelBase` has
never been touched since the file's earliest tracked commit — not once,
let alone in tandem with `DIFF_BIAS_SCALE`'s later bump. These are two
independently-evolved numbers that happen to compound (a capped input
*and* a low-visibility scale multiplying it), not a deliberate "keep diff
modest" design.

If either gets addressed, they need independent treatment — no single
constant fixes both, and they carry different risk. Raising `accelBase`
changes the actual differential recommendation entered into Forza; it
should get the same real-car validation rigor as the existing three-car
protocol before changing. Raising `DIFF_BIAS_SCALE`/`BRAKE_BIAS_SCALE`
only changes how loud diff/brakes read on the bar and the
dominant-contributor tip — it doesn't touch `mechBalance`
(a separate roll-stiffness-only calculation) or any
value the user enters into the game, so it's lower blast radius. But
there's no telemetry-backed target to raise either constant *to* — any new
number would be another guess unless someone runs the same kind of
structured test SUSP.OS already has a protocol for. Not fixed here since
it's a calibration question, not a code bug — out of scope for a
documentation pass.

## Fixed — `computeAlignment` was blind to the car's actual balance tuning (resolved)

`computeAlignment` only reacted to build type, drivetrain layout, front
weight bias, front/rear spring Hz, and roll angle — never `natMechBalance`,
`gripBalance`, or the resolved Mech Balance Target. Two cars with identical
build+layout but very different balance tuning got identical camber/toe/
caster recommendations.

Fixed by adding a PRO-only **Alignment Mode** selector (BUILD/MECH/GRIP/
MANUAL) with a Nudge Strength slider — see
[ALIGNMENT.md](ALIGNMENT.md)'s "Alignment Mode (PRO)" section for the full
formula. `computeAlignment` itself (BUILD mode) is unchanged; the nudge is
layered on top, opt-in per mode rather than an always-on background
adjustment, so the design question ("which signal, how strong") became a
user choice instead of something we had to bake in.

## Fixed — Drift/Drag camber ignored CG height and roll angle (resolved)

Every other build's camber target scaled with `rollDeg×camberGain` (itself
derived from `cgHeight`) — see [ALIGNMENT.md](ALIGNMENT.md)'s Camber table.
Drift and Drag instead returned fixed constants regardless of those inputs,
so two drift cars with very different CG heights got the same camber
recommendation.

Fixed by folding Drift (`optimalCamber:-2.5`) and Drag (`optimalCamber:-0.2`)
into the same roll-compensated formula every other build uses, instead of a
separate branch with hardcoded values. Verified manually: Drift camber now
moves from −1.2° to −4.0° (clamp) as CG height goes from 450mm to 800mm on
the same car, where it used to stay frozen at −3.0° regardless.

## Open — Ride-height-derived CG height and bottoming risk are unvalidated heuristics

The PRO CHASSIS section's RIDE HEIGHT → CG toggle estimates CG height as
`tyreRadiusAvg + weight-weighted rideHeightAvg`, and the accompanying
SAG vs LOAD chart derives static sag purely from ride Hz (`g/(2π·hz)²`),
plotted linearly against a vertical load factor. Unlike `ARB_RS_SCALE`, `DAMPING_CALIBRATION`,
`TIRE_LOAD_SENS`, and `TIRE_MECH_SCALE` — all tied in the README to real
telemetry/testing — neither formula has been validated against actual
Forza CG-height behaviour or real bottoming events. Both are geometric
plausibility checks, not measured physics:

- CG height genuinely depends on engine position, body height, and mass
  distribution — none of which are available inputs. The formula sanity
  checks against the existing manual-entry hint's ballpark ranges (a
  typical sports car lands ≈450mm, in the middle of the 400–460mm
  guidance) but that's a single spot-check, not a validated model across
  vehicle classes.
- Bottoming risk is deliberately static-only (sag vs. entered ride height)
  and does not fold in dynamic load transfer from cornering, braking, or
  bumps — a car flagged LOW could still bottom out under hard braking or
  a big compression, and a car flagged HIGH/BOTTOMED may never actually
  touch down if driven gently. The LOW/MED/HIGH/BOTTOMED thresholds
  (0.5/0.8/1.0 sag-to-ride-height ratio) are round numbers chosen for
  intuitive spacing, not derived from any real bottoming-incident data.

Both toggle state and its ride-height inputs (`useRideHeightCG`,
`rideHeightF`, `rideHeightR`) deliberately follow the `useMeasuredNatBal`
precedent and are excluded from `CODEC_FIELDS` — only the resulting
`ch.cgHeight` value travels in share codes, so this is a computed-locally,
shared-as-output pattern like the MEASURE NAT BAL flow, not an oversight.
