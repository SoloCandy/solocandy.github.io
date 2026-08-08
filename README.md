# SUSP.OS — Suspension Tuning Calculator

[![Live Demo](https://img.shields.io/badge/live%20demo-solocandy.github.io%2Fsusp--os-e2e8f0?style=flat-square)](https://solocandy.github.io/susp-os/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A single-file suspension tuning calculator for **Forza Horizon**, **Forza Motorsport**, and **BeamNG.drive**. Enter your car's physical stats and a handling target — SUSP.OS outputs values for springs, dampers, anti-roll bars, alignment, brakes, and differential, all grounded in real suspension physics: exact in-game clicks for the Forza titles, and real physical units (N/m, N/m/s) for BeamNG.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://docs.google.com/spreadsheets/d/1ySrVkgQpohIduhdLCwe99p3d6KmWXKgck5Uk-qDOlPw/edit?usp=sharing)

---

## Quick Start

**[Open the live app](https://solocandy.github.io/susp-os/)** — or download `index.html` and open it in any browser. No install, no server, no build step.

> **Offline note:** React and Babel load from a CDN on first use. Once cached, the app works fully offline. For a fully air-gapped setup, open it once with internet access, then it works without a connection.

---

## What It Does

Forza's suspension tuning menus expose raw numbers — spring rate lb/in, damper clicks, ARB clicks — with no guidance on what those numbers mean physically. SUSP.OS bridges that gap:

1. **You describe your car** — weight, front weight bias, drivetrain layout, build type, and tyre sizes. In PRO mode: wheelbase, track widths, and CG height for full chassis geometry.
2. **You set a handling target** — ride stiffness, mech balance target (how rear-biased the roll stiffness should be for your drivetrain and build), damping character, and differential intent. The balance guide shows recommended ranges for your layout and build type, and flags how far your chassis natural balance sits from the target.
3. **SUSP.OS computes the physics** — spring rates from natural frequency targets, damper clicks from critical damping coefficients, ARB split solved to hit your mech balance target, alignment geometry, brake bias, and differential lock percentages.
4. **You enter the output values into your game's tuning menu** — springs, dampers, ARBs, alignment, brakes, and differential: exact clicks for the two Forza titles, real physical units for BeamNG.

The result is a tune that starts from a principled baseline rather than trial-and-error guessing.

---

## Complexity Tiers

A **BEG / INT / PRO** toggle in the header controls how much of the input surface is visible. A short in-app guide opens the first time you enter each tier — reopen it any time with the **?** button. The **TERMS** button next to it opens a searchable glossary (Hz, ζ/damping ratio, ARB, mech balance, camber/toe/caster, and more) — not tied to any tier, available any time you forget what a word means.

A **VISUALS** card is pinned to the bottom of the sidebar (collapsible, stays put while the sections above it scroll) and holds every dial/graph in one place — the ARB split dial with ROLL/ARB SHARE, the RIDE spring-Hz dial, the DAMPERS rebound/bump dial, and (when RIDE HEIGHT → CG is active) the SAG vs LOAD chart — so they're visible regardless of which input section is currently open, instead of being scattered across ANTI-ROLL BARS/RIDE/DAMPERS/CHASSIS.

A **GARAGE** drawer slides out from the right (button at the top-right of the header, every tier) and holds everything you save. Each entry is a **chassis**, a **build** (feel + diff tune), or a **car** carrying both — a car gives you separate LOAD CHASSIS and LOAD BUILD buttons, so you can mix one car's chassis with another's tune, and every load is undoable. Entries take notes and your own tags, and derive automatic ones (drivetrain, weight balance, stiffness band, build type) that you can search on directly, alongside filter-by-kind and sort. The six factory presets are pinned read-only at the top. This replaces the old split between a chassis-only GARAGE drawer inside CHASSIS and a tune-only MY BUILDS drawer inside BUILD.

| Tier | Surface |
|---|---|
| **BEG** | Layout, build type (Street / Track / Drift / Rally / Offroad / Drag), weight, and front bias plus three feel sliders (Ride Stiffness, Balance, Character). Factory presets in the GARAGE drawer provide build-appropriate starting points, with ★ marking the one matching your build type. ARB balance is set automatically for your layout and build type. Beginner also gets the full garage — saving a chassis means not retyping weight and bias every time you switch cars. |
| **INT** | All BEG inputs plus ARB stiffness modes (AUTO / BASIC / ROLL ° / SHARE %) with ARB Bias, an ARB balance mode toggle (WEIGHT / NEUTRAL — NEUTRAL solves the F/R split to exactly cancel the springs' contribution to the balance bar) with a **Split Direction** toggle under WEIGHT (SAME tracks the reference balance directly; OPPOSITE mirrors it around 50/50 so the bars counteract rather than reinforce it), individual ride frequency and damping controls (including SETTLE TIME mode — set a target settle time and ζ is back-calculated per axle, and REBOUND/BUMP MODE toggles), drivetrain intent sliders, and a **Diff Type** selector (Race / Sport / Rally / Offroad / Drift) with per-type output scaling and recommended type based on build. |
| **PRO** | All INT inputs plus tyre sizes, balance guide, chassis balance / grip bias / stability readouts, geometry gap, Mech Balance Target slider, a **MAN** ARB stiffness mode (set front/rear ARB clicks directly, bypassing the budget/split system — hides Balance Mode while active) and **CHASSIS** / MECH / CO-SOLVE ARB balance modes (added on top of WEIGHT / NEUTRAL — CHASSIS behaves like WEIGHT but is anchored to the car's actual natural mech balance instead of raw weight %, so it's the mode that actually benefits from a MEASURE NAT BAL reading — CHASSIS gets the same Split Direction toggle as WEIGHT), Hz MECH mode, full chassis geometry (wheelbase, track widths, CG height — with a **RIDE HEIGHT → CG** toggle to derive CG height from front/rear ride height and tyre radius instead, which also surfaces a SAG vs LOAD chart), per-wheel load transfer readouts, a differential **MANUAL** mode plus a **MATCH CHASSIS** toggle for AUTO mode (biases the EXIT/ENTRY sliders toward your chassis mech target — no effect once MANUAL is selected), an **Alignment Mode** selector (BUILD / MECH / GRIP / MANUAL — MECH and GRIP nudge camber/toe toward the car's balance tuning, scaled by a Nudge Strength slider), and **measured natural balance** calibration (enter an in-game reading to replace the geometry prediction as the solver baseline). CO-SOLVE mode includes **Auto Spring Share** — automatically finds the spring/ARB split that equalises utilisation of both, with SPR CORR / ARB CORR readouts showing each source's contribution to the balance correction. A wheel lift warning appears when rear ride frequency is ≥20% higher than front. In **BEAMNG** mode, PRO also shows **Motion Ratio F / R** — BeamNG's sliders act at the spring/damper rather than the wheel, so this converts the solver's wheel-rate output to what the game expects. |

Reference docs for maintainers:
- [CODE_MAP.md](docs/CODE_MAP.md) — how `index.html` is laid out, and which legacy code must not be deleted
- [SLIDERS.md](docs/SLIDERS.md) — every slider's range, tier, physical effect, and oversteer/understeer direction
- [PHYSICS.md](docs/PHYSICS.md) — Hz/spring/damping solve math (Ride Stiffness → spring rate/clicks, Hz modes, settle time, the LLT grip model)
- [FORMULAS.md](docs/FORMULAS.md) — the ground-truth handling-balance contributor formulas
- [ALIGNMENT.md](docs/ALIGNMENT.md) — camber/toe/caster target formulas and per-build/layout baselines
- [CODEC.md](docs/CODEC.md) — the share-code field ID table (never reuse an id)
- [PERSISTENCE.md](docs/PERSISTENCE.md) — localStorage keys and when to bump a version
- [PRESETS.md](docs/PRESETS.md) — factory preset values and how to add a new one
- [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — unresolved quirks and test-coverage gaps

---

## Game Modes

A **HORIZON / MOTORSPORT / BEAMNG** toggle in the header picks which game's
tuning menu the output is written for. It only changes *units and ceilings* —
the underlying physics solve (spring/damper/ARB targets, handling balance,
alignment) is identical across all three.

**Horizon and Motorsport** express output as abstract 1–N "clicks," because
that's what those games' tuning screens use — Forza hides the real internal
units, so each has its own click ceiling (Horizon: 65 ARB / 20 damper.
Motorsport: 40 / 40). **BeamNG** has no such fixed scale — it builds its
tuning sliders per-vehicle from the car's own config — so that mode skips the
click conversion and outputs the real values directly: spring rate in N/m,
damping in N/m/s, anti-roll rate in N/m.

A few things are specific to BEAMNG mode: BASIC ARB stiffness is Forza-only
and hidden there; the anti-roll number is BeamNG's least-validated output
(see below); and PRO gains a **Motion Ratio F / R** input, since BeamNG's
sliders act at the spring/damper rather than the wheel. Full detail —
the unit table, all four behavioural differences from Forza, and why no new
calibration constant was needed — is in
[**BEAMNG mode (physical units)**](#calibration) under Calibration.

---

## Calibration

Key empirical constants calibrated from real Forza data:

| Constant | Value | Description |
|---|---|---|
| `ARB_RS_SCALE` | 240 | Maps ARB click → roll stiffness (N·m/rad) |
| `DAMPING_CALIBRATION` | 0.00135 | Maps damper click → critical damping coefficient. Empirically validated via SimHub telemetry: Forza uses lbf/ft/s internally, not N/mm/s — the ×1.35 correction factor confirmed by comparing suspension settling behaviour under baseline vs corrected damper values |
| `TIRE_LOAD_SENS` | 0.15 | Grip falloff per unit Fz/Fz_ref — the tyre load sensitivity that lets roll stiffness shift balance |
| `TIRE_MECH_SCALE` | 0.08 | Tyre width rear/front ratio → mech balance offset via `0.08 × ln(twR/twF)`. Forza's displayed mech balance incorporates tyre width asymmetry; this correction ensures the calculator's output matches Forza's reading. Calibrated from Stage 2 testing (same suspension, tyre widths swapped) across MX-5, Ultima, and Scirocco |
| `MECH_BAL_GAIN` | 1.8 | Axle grip-capacity delta → balance offset (calibrated to the 0.5-neutral scale) |
| `WIDTH_GRIP_EXP` | 0.4 | Tyre width → grip capacity, sub-linear exponent |
| `DIFF_BIAS_SCALE` | 0.14 | Diff lock % → handling bias contribution |
| `DIFF_TYPE_SCALE` | race 1.00 / sport 0.88 / rally 0.76 / offroad 0.52 / drift 1.10 | AUTO solver multipliers per diff type. Community-estimated: same slider % produces less effective lock on Rally/Offroad than Race, more on Drift. Sport is accel-only (no decel slider in-game). |
| `BRAKE_BIAS_SCALE` | 0.20 | Brake balance deviation → handling bias contribution |

Constants validated through a structured test protocol across three cars — 2017 Mazda MX-5 Cup, 2015 Ultima Evolution Coupe 1020, and 2011 Volkswagen Scirocco R — covering balanced, understeer, and oversteer tyre configurations and ARB ±10 click sensitivity sweeps.

**These constants only apply to the two Forza modes.** `ARB_RS_SCALE` and `DAMPING_CALIBRATION` exist to bridge real physics onto Forza's abstract 1–N "click" scales, which are needed because Forza hides its internal units. The **BEAMNG** mode skips that step entirely and emits the pre-conversion values the solver already works in — N/m for spring and anti-roll rate, N/m/s for damping — so it introduces **no new calibration constant and needs no validation protocol**. If a BeamNG-specific fudge factor ever turns out to be necessary, that is a signal the "just skip the click compression" premise broke down somewhere and should be re-examined rather than patched. See [PHYSICS.md](docs/PHYSICS.md).

**Ride-height-derived CG height** (PRO CHASSIS section, RIDE HEIGHT → CG toggle): estimates CG height as tyre radius + weight-weighted ride height. Unlike the table above, this is a plain geometric heuristic, not a measured/validated constant — real CG height also depends on engine position, body height, and mass distribution, none of which are available inputs. Treat it as a starting point, same spirit as the existing CG Height field's ballpark hint. See [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

**Game limits:** Horizon — ARB 65 clicks, damper 20 clicks. Motorsport — ARB 40 clicks, damper 40 clicks. BeamNG — **none**, see below.

**BEAMNG mode (physical units).** BeamNG builds its tuning sliders per vehicle from the car's Jbeam `variables` block, so unlike the Forza titles there is no fixed click scale to calibrate against — and the min/max you actually see depends on which suspension part or mod is installed. Rather than invent a third scale, this mode skips the click-compression step and outputs the real values the solver already computes, in the units BeamNG's own sliders use:

| BeamNG slider | Unit | Note |
|---|---|---|
| Spring Rate | **N/m** | not N/mm — confusing the two is a 1000× error |
| Bump / Rebound Damping | **N/m/s** | the same quantity as N·s/m |
| Anti-Roll Spring Rate | **N/m** | a *linear* rate, converted from roll stiffness by `k = 2·rs/track²` |

Nothing is clamped, quantised, or warned about, because there is no ceiling to clamp to.

**Motion Ratio F / R** (PRO CHASSIS, this mode only) is the one input Forza doesn't need. Forza displays wheel rate, which is what the solver produces; BeamNG's sliders act at the spring and damper, so an inboard spring must be stiffer by `1/mr²` to give the same wheel rate. Leave it at 1.0 for a direct-acting strut. It affects only the numbers you type into the game — Hz, roll stiffness and handling balance are wheel-rate quantities and don't move when you change it.

Four differences from the Forza modes:

- **BASIC ARB stiffness is hidden** — its budget is defined as a percentage of the click ceiling, so it has no meaning without one. AUTO, ROLL °, SHARE % and MAN all work normally; MAN takes N/m instead of clicks, and converts losslessly in both directions when you switch modes.
- **The anti-roll number is the least reliable output here.** It measured 4–6× softer than one test vehicle's stock values. The cause is now identified: BeamNG's figure is the rate at the bar's own lever arm, reaching roll stiffness via `arm²`, while `k = 2·rs/track²` assumes the bar acts at the wheels. `ARB_RS_SCALE` was ruled out — it isn't in the physical-mode path at all. The arm length isn't exposed by the game and differs per vehicle, so no correction factor has been invented to close the gap. See [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).
- **Rebound-to-bump ratio runs lower than BeamNG's own defaults.** The stock vehicle sampled sat around 2.5:1 where the app's default Bump Ratio gives about 1.8:1. Raise Bump Ratio if you want to match BeamNG's house style.
- **Balance figures differ very slightly from Forza for the same inputs.** Forza deliberately recomputes roll stiffness back out of the rounded click values so the balance bar reflects what the game will really do with the numbers you type; BeamNG has no rounding to model. This is intended.

This mode is exploratory: it targets generic physical output, not values scaled to one specific car or suspension mod's slider range.

**Mechanical balance accuracy:**

Mechanical balance (the **MECH BALANCE** readout) is the roll-stiffness rear fraction, matching the metric Forza displays. The calculator's prediction includes tyre-width correction via `TIRE_MECH_SCALE`.

For **asymmetric tyres** (different widths front/rear), the correction typically brings error down to **±0.02**.

For **symmetric tyres** (same width front/rear), a small residual offset remains (**±0.01 to ±0.04**, larger for extreme setups with very soft springs + high ARBs). This is not an `ARB_RS_SCALE` error — springs contribute 88%+ of total roll stiffness, so scaling adjustments have negligible effect on the mechBalance ratio. The residual reflects Forza's incorporation of minor load-sensitivity and motion-ratio effects not captured in the simplified roll-stiffness-only model. Use **MAN mode** to directly input your real in-game ARB values and verify the calculator against Forza's actual reading.

The physical at-limit tendency (**GRIP BIAS**) is derived separately from a lateral-load-transfer model: front/rear load transfer set by the roll-stiffness ratio, tyre load sensitivity (`TIRE_LOAD_SENS`), and tyre width as a sub-linear grip multiplier (`WIDTH_GRIP_EXP`). The two are reconciled by bisection so a balance target round-trips to the spring/ARB split that achieves it.

---

## How It Works

The entire app is a single HTML file containing:
- **Physics engine** — `flatRideRearHz`, `feelToPhysics`, `computeTune`, `computeAlignment`, `computeDiff`, `mechBalanceLLT` — pure JS, no React dependency
- **React UI** — in-browser JSX transpilation via `@babel/standalone`
- **Persistence** — `localStorage` via a custom `usePersist` hook; degrades gracefully in private browsing
- **Share codec** — a sparse `id:value` list, pipe-delimited and Base64-encoded. Only fields that differ from their default are emitted, so code length varies with how far a tune strays from stock. Ids are permanent and never reused; an unknown id (from a newer app version) is skipped on decode rather than failing, and any field missing from a code decodes to its default. See [CODEC.md](docs/CODEC.md).

The physics functions are at the top of the `<script>` block and are pure — no React dependency, so they can be read or lifted out on their own. Two test suites are included: `tests.js` (spring/damper solving, `computeDiff`, `computeAlignment`) and `tests-beamng.js` (the physical-unit game mode).

> **`tests.js` does not test `index.html`.** It re-declares the physics
> functions inside the test file rather than importing them, so it passes
> whether or not the app is intact, and drift between the two copies is
> silent. Treat it as an executable spec, not a regression net — changes to
> `index.html` need checking in the browser. See
> [CODE_MAP.md](docs/CODE_MAP.md) and [PHYSICS.md](docs/PHYSICS.md).
>
> **`tests-beamng.js` does.** It lifts the real physics layer out of
> `index.html` and drives it, so it fails when the app breaks. It covers the
> BEAMNG mode specifically, plus a guard that the Forza modes still clamp to
> their own limits.

**Data flow:** `ch`/`fe`/`dr` (chassis/feel/drivetrain state) → `feelToPhysics(ch, fe)` resolves feel settings into concrete physics parameters (Hz, ARB balance mode, damping mode) → `computeTune(ch, physics, gameMode)` solves springs/dampers/ARBs → `computeDiff(ch, fe, dr)` solves differential locks independently → `computeAlignment(ch, tune, layout, buildType)` derives camber/toe/caster from the tune result. All four are pure functions with no shared mutable state — see [FORMULAS.md](docs/FORMULAS.md) for the handling-balance math each one feeds into.

---

## Development

No build tools required. Open `index.html` in a browser, edit with any text editor, reload to see changes.

```
node tests.js          # physics unit tests (mirrored copy — see caveat above)
node tests-beamng.js   # physical-unit mode tests (reads index.html directly)
```

---

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** after first load
- No build step, no Node.js, no dependencies

---

## Feedback

- **Found a bug or something looks wrong?** [Open an issue](https://github.com/SoloCandy/susp-os/issues/new/choose) — a share code (SHARE → COPY CODE) makes it much easier to reproduce.
- **Have an idea or a question?** [Start a discussion](https://github.com/SoloCandy/susp-os/discussions).
- **Prefer email?** [soloc4ndy@gmail.com](mailto:soloc4ndy@gmail.com).

---

## Credits

- Physics foundation: [NumberlessMath](https://docs.google.com/spreadsheets/d/1ySrVkgQpohIduhdLCwe99p3d6KmWXKgck5Uk-qDOlPw/edit?usp=sharing) (2020)

---

## License

MIT
