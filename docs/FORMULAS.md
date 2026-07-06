# SUSP.OS — Handling Balance Formulas

Ground-truth math behind every oversteer/understeer (OS/US) contribution
shown in the Handling Balance bar. Convention: **positive = oversteer,
negative = understeer** for every value below.

> This file exists because hint text and slider labels can drift out of
> sync with the actual math (this happened once with Damping Bias — the
> hint said the opposite of what `bDampBias` computes). When in doubt about
> which direction a control pushes handling, check the formula here, not
> the UI copy.

Scope note: this file is *balance-direction* math only. For the actual
Hz/spring-rate/damper-click solve math feeding these formulas' inputs
(`zetaF`/`zetaR`, `rsSpF`/`rsSpR`, etc.), see [PHYSICS.md](PHYSICS.md).

---

## Springs & ARBs (`computeTune`, ~index.html:680-690)

```js
const spShare = rsTotal>0 ? (rsSpF+rsSpR)/rsTotal : 1;
const abShare = rsTotal>0 ? (rsAbF+rsAbR)/rsTotal : 0;
const bSp = (rsSpF+rsSpR)>0 ? (nf-(rsSpF/(rsSpF+rsSpR)))*100*spShare : 0;
const bAb = (rsAbF+rsAbR)>0 ? (nf-(rsAbF/(rsAbF+rsAbR)))*100*abShare : 0;
const bTot = bSp + bAb;
```

- `nf` = front weight bias fraction (`ch.frontBias/100`).
- `rsSpF/rsSpR` = front/rear roll stiffness from springs; `rsAbF/rsAbR` = from ARBs.
- Each term is weighted by its **actual share of total roll stiffness**
  (`spShare`/`abShare`) so ARBs (typically 10-15% of total) don't appear as
  influential as springs (85-90%).
- Sign: if the rear carries a *larger* fraction of that source's stiffness
  than the front weight fraction would imply, the term goes positive
  (oversteer).

## Damping (`computeTune`, ~index.html:2522-2524)

```js
const effectiveAvgZeta = (tune.zetaF+tune.zetaR)/2 || 70;
const bDampBias = -(tune.zetaF - tune.zetaR) * 16 / effectiveAvgZeta;
// more front rebound → understeer (−)
```

- `zetaF > zetaR` (front damped harder than rear) → **negative** → understeer.
- `zetaR > zetaF` (rear damped harder than front) → **positive** → oversteer.
- This is the formula that governs the Damping Bias slider: right
  (REAR bias, front stays firm) = oversteer; left (FRONT bias) = understeer.

## Brakes (~index.html:2521-2522)

```js
const bBrakeEntry = -(brakeBias-50) * BRAKE_BIAS_SCALE; // BRAKE_BIAS_SCALE = 0.20
// high front bias → understeer (−)
```

- `brakeBias` is % front brake bias (50 = even). Above 50 (more front brake)
  → negative → understeer on entry. Below 50 (more rear brake) → positive
  → oversteer-leaning (more prone to rear lock-up rotation).

## Differential (`computeDiff`, ~index.html:848-867)

```js
const nf = ch.frontBias/100;
// RWD:
bDiffAccel =  vals.accel * (1-nf) * DIFF_BIAS_SCALE;   // rear accel lock → oversteer (+)
bDiffDecel =  vals.decel * (1-nf) * DIFF_BIAS_SCALE;   // rear decel lock → oversteer (+)
// FWD:
bDiffAccel = -vals.accel * nf     * DIFF_BIAS_SCALE;   // front accel lock → understeer (−)
bDiffDecel = -vals.decel * nf     * DIFF_BIAS_SCALE;   // front decel lock → understeer (−)
// AWD (C = center split fraction, 0=all front, 1=all rear):
bFA = -vals.frontAccel * nf     * (1-C) * DIFF_BIAS_SCALE;  // front accel → understeer (−)
bRA =  vals.rearAccel  * (1-nf) * C     * DIFF_BIAS_SCALE;  // rear accel  → oversteer (+)
bFD = -vals.frontDecel * nf     * (1-C) * DIFF_BIAS_SCALE;  // front decel → understeer (−)
bRD =  vals.rearDecel  * (1-nf) * C     * DIFF_BIAS_SCALE;  // rear decel  → oversteer (+)
bDiffFront = bFA + bFD;
bDiffRear  = bRA + bRD;
bDiffAccel = bFA + bRA;
bDiffDecel = bFD + bRD;
```

- `DIFF_BIAS_SCALE = 0.14`.
- **Simplification to know about:** the model treats *any* lock magnitude
  (accel or decel, on whichever axle is driven) as pushing the same
  direction — it does not distinguish "decel lock resists rotation" from
  "decel lock is rotation" the way real-world tuning intuition sometimes
  does. The EXIT/ENTRY slider hint text follows the more nuanced tuning
  intuition (e.g. "STABLE increases lock — resists lift-off oversteer"),
  which can read as being in tension with this crude aggregate formula.
  Trust the formula for the numeric Handling Balance total; trust the hint
  text for what the lock physically does.

## Total (~index.html:2525)

```js
const bTotFull = tune.bTot + diff.bDiffAccel + diff.bDiffDecel + bBrakeEntry + bDampBias;
```

This is the number shown as the overall Handling Balance total (and its
color-coded OS/US label). `tune.bTot` already includes `bSp + bAb`.

---

## Quick sign reference

| Source | More rear-side stiffness/lock/damping | More front-side stiffness/lock/damping |
|---|---|---|
| Springs (`bSp`) | oversteer (+) | understeer (−) |
| ARBs (`bAb`) | oversteer (+) | understeer (−) |
| Damping (`bDampBias`) | oversteer (+) | understeer (−) |
| Brakes (`bBrakeEntry`) | oversteer (+) (more rear brake) | understeer (−) (more front brake) |
| Diff (`bDiffAccel/Decel/Front/Rear`) | oversteer (+) (rear lock, any phase) | understeer (−) (front lock, any phase) |

See [SLIDERS.md](SLIDERS.md) for how each individual slider maps onto these
contributors.
