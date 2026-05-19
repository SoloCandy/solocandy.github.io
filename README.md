# SUSP.OS — Forza Suspension Calculator

A single-file suspension tuning calculator for **Forza Horizon 6** and **Forza Motorsport**. Translates real-world chassis physics into exact in-game click values for springs, dampers, anti-roll bars, alignment, and differential.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://forums.forza.net/t/beta-forza-suspension-calculator/97135)

---

## Quick Start

Download `susp-os-v6.html` and open it in any browser. No install, no server, no dependencies — it runs entirely offline from a single file.

**Or open directly from GitHub Pages / your host URL.**

---

## Features

### Suspension Physics
- **Flat-ride theory** — rear spring frequency derived from wheelbase and target speed so front and rear wheels hit bumps in phase
- **Damping ratios (ζ)** — rebound and bump calculated from critical damping formulas, not arbitrary numbers
- **Roll stiffness solver** — distributes roll resistance between springs and ARBs, respecting per-game click limits (Horizon: ARB 1–65, damping 1–20; Motorsport: ARB 1–40, damping 1–40)
- **Mechanical balance** — calibrated to match FH6's reported metric (70/30 blend of roll-stiffness distribution and weight distribution)

### Inputs
| Section | Controls |
|---|---|
| **Chassis** | Weight, front bias, wheelbase, CG height, track widths, motion ratios |
| **Feel** | Ride stiffness (0.80–3.50 Hz), target speed (flat-ride), rebound ζ, bump ratio / independent bump ζ |
| **Anti-Roll Bars** | ARB bias, ARB range (floor/ceiling clamp), stiffness mode (Auto / Roll ° / Share %) |
| **Alignment** | Auto (build-type aware) or manual camber, toe, caster |
| **Drivetrain** | Layout (FWD/RWD/AWD), build type, corner exit / entry bias, full manual diff |

### Outputs
- Spring rates (lb/in) with natural frequency badges (SOFT / ROAD / FIRM / RACE)
- ARB clicks with roll angle and ARB share
- Damper clicks (rebound F/R, bump F/R)
- Alignment recommendations (camber, toe, caster)
- Differential starting points with EXIT/ENTRY handling balance indicators
- **Handling Balance** — pinned bar showing understeer/oversteer bias from springs, ARBs, and differential combined
- **Mechanical Balance** — live readout matching FH6's in-game metric

### Tools
- **Tune Check** — reverse-calculate ζ from existing in-game damper values
- **Share / Import** — compressed Base64 tune codes (~128 chars) for sharing with other SUSP.OS users
- **Save slots** — 3 tune template slots (feel + drivetrain only; chassis persists separately). Pre-loaded with STREET, TRACK, and RALLY presets
- **Section resets** — individual reset buttons for Chassis, Feel, ARBs, Alignment, and Drivetrain

---

## Calibration

Key empirical constants calibrated from real FH6 data:

| Constant | Value | Description |
|---|---|---|
| `ARB_RS_SCALE` | 240 | Maps ARB click → roll stiffness (N·m/rad) |
| `DAMPING_CALIBRATION` | 0.001 | Maps damper click → critical damping coefficient |
| `MECH_BALANCE_STIFFNESS_WEIGHT` | 0.698 | FH6 blends 70% roll-stiffness balance + 30% weight balance |
| `DIFF_BIAS_SCALE` | 0.08 | Diff lock % → handling bias contribution |

Mechanical balance was calibrated across 4 data points on a Lexus LC 500 at ride stiffness 29–75 (1.58–2.83 Hz). Errors ±0.004 across all points.

---

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** — save the HTML file locally
- No build step, no Node.js, no dependencies

---

## How It Works

The entire app is a single HTML file (~96KB) containing:
- **Physics engine** — `flatRideRearHz`, `computeTune`, `computeAlignment`, `computeDiff`
- **React UI** — in-browser JSX transpilation via `@babel/standalone`
- **Persistence** — `localStorage` via a custom `usePersist` hook (degrades gracefully in private browsing)
- **Share codec** — pipe-delimited numeric array, Base64 encoded (33 values, backward-compatible)

---

## Development

No build tools required. Open the `.html` file in a browser, edit with any text editor, reload to see changes.

The physics functions (`computeTune`, `feelToPhysics`, etc.) are pure JavaScript at the top of the `<script>` block — no React dependencies — so they can be read and tested independently.

---

## Credits

- Physics foundation: [NumberlessMath](https://forums.forza.net/t/beta-forza-suspension-calculator/97135) (2020)
- Mechanical balance calibration: FH6 early access data (4-point LC 500 dataset)

---

## License

MIT
