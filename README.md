# SUSP.OS — Forza Suspension Calculator

A single-file suspension tuning calculator for **Forza Horizon** and **Forza Motorsport**. Enter your car's physical stats and a handling target — SUSP.OS outputs exact in-game click values for springs, dampers, anti-roll bars, alignment, brakes, and differential, all grounded in real suspension physics.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://forums.forza.net/t/beta-forza-suspension-calculator/97135)

---

## Quick Start

Download `index.html` and open it in any browser. No install, no server, no build step.

> **Offline note:** React and Babel load from a CDN on first use. Once cached, the app works fully offline. For a fully air-gapped setup, open it once with internet access, then it works without a connection.

---

## What It Does

Forza's suspension tuning menus expose raw numbers — spring rate lb/in, damper clicks, ARB clicks — with no guidance on what those numbers mean physically. SUSP.OS bridges that gap:

1. **You describe your car** — weight, weight distribution, tyre sizes (and, in PRO, full geometry)
2. **You choose a handling feel** — how stiff, how much body roll, damping character, diff aggression
3. **SUSP.OS computes the physics** — rear spring frequency, critical damping coefficients, roll stiffness budget, alignment geometry
4. **You enter the output values into Forza** — springs, dampers, ARBs, alignment, diff, brakes

The result is a tune that starts from a principled baseline rather than trial-and-error guessing.

---

## Complexity Tiers

A **BEG / INT / PRO** toggle in the header controls how much of the input surface is visible. A short in-app guide opens the first time you enter each tier — reopen it any time with the **?** button.

| Tier | Surface |
|---|---|
| **BEG** | Three feel sliders (Ride Stiffness, Balance, Character) plus layout, build type, weight, and front bias. ARB balance solved purely from weight distribution |
| **INT** | Full input sections — tyre sizes, ARB control with multiple balance modes, separate RIDE and DAMPERS sections, drivetrain intent sliders |
| **PRO** | Direct geometry inputs (wheelbase, track widths, CG height), per-wheel load strips, differential MANUAL mode, MATCH CHASSIS |

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
| `BRAKE_BIAS_SCALE` | 0.20 | Brake balance deviation → handling bias contribution |

**Game limits:** Horizon — ARB 65 clicks, damper 20 clicks. Motorsport — ARB 40 clicks, damper 40 clicks.

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
- **Share codec** — pipe-delimited numeric array, Base64-encoded (~210 chars, 58 values, fully backward-compatible — short legacy codes decode with new fields defaulted)

The physics functions are at the top of the `<script>` block and can be read, tested, or extracted independently. A standalone test suite is included in `tests.js` — run with `node tests.js`.

---

## Development

No build tools required. Open `index.html` in a browser, edit with any text editor, reload to see changes.

```
node tests.js   # run physics unit tests
```

---

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** after first load
- No build step, no Node.js, no dependencies

---

## Credits

- Physics foundation: [NumberlessMath](https://forums.forza.net/t/beta-forza-suspension-calculator/97135) (2020)
- Mechanical balance calibration: Forza early access data (4-point LC 500 dataset)

---

## License

MIT
