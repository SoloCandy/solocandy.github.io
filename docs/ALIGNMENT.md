# SUSP.OS — Alignment Target Reference

`computeAlignment(ch, tune, layout, buildType)` (~index.html:714-772) derives
recommended camber, toe, and caster from build type, drivetrain layout,
front weight bias, front/rear spring Hz, and roll angle. Unlike the rest of
the physics engine (see [FORMULAS.md](FORMULAS.md)), none of its constants
are calibrated against Forza telemetry — they're reasonable static-alignment
starting points from general chassis-setup convention, not measured. This
file exists so they're documented *somewhere* rather than only as inline
magic numbers.

`computeAlignment` itself is BUILD mode's engine only — PRO mode wraps it
with an **Alignment Mode** selector (`al.mode`) that can nudge its output
toward the car's actual balance tuning instead of taking BUILD's numbers
as-is. See "Alignment Mode (PRO)" below.

## Camber

```js
camberGain = clamp(0.55, 0.85, 1.05 - cgHeight*0.8)     // roll-compensation gain, higher CG → less gain
rearGainMult = FWD: 0.50 | AWD: 0.70 | RWD: 0.75         // rear camber reacts less to roll than front
fwdReduction = FWD: 0.3 | else: 0.0                      // FWD front camber reduced (needs front grip for both steering and traction)
```

All builds use the same roll-compensated formula — `optimalCamber` is the
only thing that varies per build:

```js
recCamberF = clamp(-4.0, 0.0, optimalCamber - rollDeg*camberGain + fwdReduction)
recCamberR = clamp(-3.5, 0.0, optimalCamber - rollDeg*camberGain*rearGainMult)
```

| Build | optimalCamber |
|---|---|
| Drift | −2.5 |
| Drag | −0.2 |
| Street | −1.0 |
| Track (or unmatched) | −1.5 |
| Rally | −0.8 |
| Offroad | −0.3 |

Drift and Drag used to be fixed constants, ignoring CG height, track width,
and actual roll angle entirely — two drift cars with very different CG
heights got the same camber recommendation. Fixed to use the same
roll-compensated formula as every other build (see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the history).

## Toe front (`recToeF`)

```js
recToeF = clamp(-0.20, 0.15, toeFByBuild + (frontBias-50)×-0.003 + (fHz-1.8)×0.010)
```

| Build | toeFByBuild (FWD / other layouts) |
|---|---|
| Street | 0.05 / 0.0 |
| Track | 0.05 / −0.05 |
| Drift | 0.0 / −0.10 |
| Rally | 0.0 / 0.0 |
| Offroad | 0.05 / 0.05 |
| Drag | 0.0 / 0.0 |
| *(unmatched build)* | −0.05 (fallback) |

The `(frontBias-50)×-0.003` term nudges toe-in slightly with front-heavier
cars; `(fHz-1.8)×0.010` nudges toward more toe-in with stiffer front springs
(verified against the actual formula — a prior version of this doc had the
direction backwards).

## Toe rear (`recToeR`)

```js
recToeR = clamp(0.0, 0.25, toeRBase + (rearBiasFraction-0.5)×0.20 + max(0, rHz-fHz)×-0.03)
```

`toeRBase` by build/layout (`toeRByBuild[build][layout]`, a lookup table
matching `toeFByBuild`'s style):

| Build | RWD | AWD | FWD |
|---|---|---|---|
| Drift | 0.05 | 0.05 | 0.05 |
| Drag | 0.0 | 0.0 | 0.0 |
| Offroad | 0.15 | 0.15 | 0.10 |
| Rally | 0.10 | 0.08 | 0.05 |
| Street | 0.15 | 0.08 | 0.05 |
| Track (or unmatched) | 0.10 | 0.08 | 0.05 |

The `(rearBiasFraction-0.5)×0.20` term adds toe-in as the car gets more
rear-weight-biased; `max(0, rHz-fHz)×-0.03` reduces rear toe-in when the
rear is stiffer than the front (a stiffer rear already resists rotation,
so it needs less toe-in help).

## Caster (`recCaster`)

```js
recCaster = clamp(4.0, 7.5, casterBase + (fHz-1.8)×0.4 + (frontBias-50)×0.04 + (layout==='FWD' ? -0.5 : 0))
```

| Build | casterBase |
|---|---|
| Drift | 4.8 |
| Drag | 4.0 |
| Offroad | 4.5 |
| Street | 5.2 |
| Track / Rally (or unmatched) | 5.8 |

Stiffer front springs and more front weight bias both increase recommended
caster (more self-centering force needed); FWD gets a flat −0.5° reduction
regardless of build (unlike camber/toe, which differentiate AWD from RWD,
caster only special-cases FWD vs everything else).

## Adding a new build type

1. Add camber `optimalCamber` case (or a fixed pair if it should behave
   like Drift/Drag).
2. Add a `toeFByBuild` entry.
3. Add a `toeRBase` case (all three layouts).
4. Add a `casterBase` case.
5. Update the tables in this file to match.

## Alignment Mode (PRO)

PRO mode adds an ALIGNMENT sidebar section (`zone-alignment`,
~index.html:4474) with a 4-way mode toggle (`al.mode`, `ALIGN_MODE_DEC`).
INT and Beginner always get BUILD — the whole section (and thus MECH/GRIP/
MANUAL) is PRO-only, since there's nothing to configure without it.

| Mode | What it does |
|---|---|
| **BUILD** (default) | `computeAlignment`'s output, unchanged — see the rest of this file |
| **MECH** | Nudges camber and toe toward `gap = resolveArbBalTarget(ch,fe) − naturalMechBalanceOf(ch)` — the same signal `computeDiff`'s MATCH CHASSIS uses (see [FORMULAS.md](FORMULAS.md)). Reinforces whatever oversteer/understeer intent you've explicitly dialed into the Mech Balance Target |
| **GRIP** | Nudges using `gripGap = -(natGripBalance-0.5)*2` instead — counteracts the chassis's own natural at-limit tendency (understeer-prone chassis gets pushed toward more aggressive/oversteer-leaning alignment, and vice versa), independent of whatever ARB balance mode is active |
| **MANUAL** | Direct entry — wires up `al.camberF/camberR/toeF/toeR/caster` (these fields, plus `al.alignManual`, predate this feature and were previously unused dead state with no UI) |

**MECH/GRIP nudge formula** (~index.html:2506-2521):

```js
normGap = clamp(-1, 1, rawGap / 0.30)       // rawGap = mechGap or gripGap depending on mode
k = normGap * (nudgeStrength / 100)          // nudgeStrength: 0-100 slider, 0 = identical to BUILD

recCamberF = clamp(-4.0, 0.0, buildCamberF - 0.5*k)   // more oversteer-leaning (k>0) → more front bite
recCamberR = clamp(-3.5, 0.0, buildCamberR + 0.3*k)   // more oversteer-leaning (k>0) → less rear grip, freer rotation
recToeF    = clamp(-0.20, 0.15, buildToeF - 0.05*k)   // more oversteer-leaning (k>0) → more toe-out, sharper turn-in
recToeR    = clamp(0.0, 0.25, buildToeR - 0.05*k)     // more oversteer-leaning (k>0) → less toe-in, freer rear
recCaster  = buildCaster                              // never adjusted — not an oversteer/understeer lever
```

The **Nudge Strength** slider (0-100%, default 50%) controls `k`'s
magnitude only — direction always comes from `rawGap`'s sign. At 0% every
output is identical to BUILD; verified manually that camber/toe converge
back to the BUILD baseline exactly at 0%.

Persisted in `suspos_al_v2` (see [PERSISTENCE.md](PERSISTENCE.md)) alongside
the legacy `alignManual` boolean, which is still read as a fallback for old
saved state (`al.mode ?? (al.alignManual ? 'manual' : 'build')`) so existing
users who had it set don't silently revert to BUILD.
