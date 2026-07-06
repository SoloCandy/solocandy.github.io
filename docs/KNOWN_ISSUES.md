# SUSP.OS — Known Issues & Limitations

Real quirks and gaps found during development that are easy to lose track
of without a written trail. Not a general bug tracker — just things that
either can't be trivially fixed, or were fixed here and are worth
remembering *why* they broke in the first place.

## Fixed — MATCH CHASSIS ignored layout polarity for FWD (resolved)

`computeDiff`'s MATCH CHASSIS correction (~index.html:799-814) biases
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

## Fixed — Test coverage gap: `computeDiff` now covered (resolved)

`tests.js` now includes a `computeDiff` suite: layout-dependent lock/balance
signs for RWD/FWD/AWD, diff type scaling (drift/offroad vs race), SPORT's
decel lockout, MANUAL mode bypassing MATCH CHASSIS, and — critically — a
regression guard for the MATCH CHASSIS FWD-polarity bug above (asserts
"FWD + MATCH CHASSIS + oversteer-wanting target → lower front lock than
baseline, not higher"). This is exactly the test that would have caught
that bug immediately instead of it surviving until manual testing.

## Open — Test coverage gap: `computeAlignment` untested

`computeAlignment` (camber/toe/caster target derivation by layout/build) still
has zero automated coverage. Not fixed here since writing it is a separate,
sizeable task — flagged so it's a known gap rather than an assumed one.

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
