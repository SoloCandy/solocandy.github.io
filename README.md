# SUSP.OS — Forza Suspension Calculator

A single-file suspension tuning calculator for **Forza Horizon** and **Forza Motorsport**. Enter your car's physical stats and a handling target — SUSP.OS outputs exact in-game click values for springs, dampers, anti-roll bars, alignment, brakes, and differential, all grounded in real suspension physics.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://forums.forza.net/t/beta-forza-suspension-calculator/97135)

---

## Quick Start

Download `index.html` and open it in any browser. No install, no server, no build step.

> **Offline note:** React and Babel load from a CDN on first use. Once cached, the app works fully offline. For a fully air-gapped setup, open it once with internet access, then it works without a connection.

**Or open directly from the hosted URL.**

---

## What It Does

Forza's suspension tuning menus expose raw numbers (spring rate lb/in, damper clicks, ARB clicks) with no guidance on what those numbers mean physically. SUSP.OS bridges that gap:

1. **You describe your car** — weight, weight distribution, wheelbase, CG height, aero balance
2. **You choose a handling feel** — how stiff, how much body roll, damping character, diff aggression
3. **SUSP.OS computes the physics** — flat-ride rear frequency, critical damping coefficients, roll stiffness budget, alignment geometry
4. **You enter the output values into Forza** — springs, dampers, ARBs, alignment, diff, brakes

The result is a tune that starts from a principled baseline rather than trial-and-error guessing. Fine-tune from there.

---

## Inputs

### CHASSIS
| Field | Description |
|---|---|
| Weight | Total vehicle weight (lb or kg) — from Forza's car stats screen |
| Front Weight Bias | % weight on the front axle |
| Aero Balance | Forza's aero balance readout (0.00–1.50). Enter after setting aero to max cornering — SUSP.OS factors it into the handling balance so you can tune mechanics to cancel it |
| Aero Efficiency | Forza's aero efficiency readout (0.100–0.900). Lower = more total downforce — scales the aero's contribution to balance proportionally |
| Wheelbase | Axle-to-axle distance in mm |
| CG Height | Centre-of-gravity height in mm |
| Track widths | In the Advanced section — affect lateral weight transfer and ARB calculations |

**Derived info strips** (shown automatically below inputs):
- **F CORNER / R CORNER** — per-wheel corner mass at rest
- **XFER F / XFER R** — lateral weight transfer per g of cornering, per axle (corner mass × CG height ÷ track width)
- **OUT F / OUT R** — outer wheel load at 1g cornering (corner mass + transfer)
- **IN F / IN R** — inner wheel load at 1g cornering (corner mass − transfer)

### FEEL
| Field | Description |
|---|---|
| Ride Stiffness | Front spring frequency slider, 0.80–3.50 Hz. Click the Hz readout to type a target frequency directly. Green **ROAD** and **RACE** tick marks show the typical band for this car's corner weight — lighter cars sit higher on the scale |
| Rear Hz mode | Three-button toggle controlling how rear frequency is derived |
| Rebound ζ | Damping ratio for the rebound stroke. 70% = Butterworth (critically tuned). >100% = overdamped |
| Bump | Either a ratio of rebound (BUMP RATIO mode) or independent ζ (INDEPENDENT mode) |

**Rear Hz modes:**
| Mode | Behaviour |
|---|---|
| **FLAT RIDE** | Rear Hz derived from the flat-ride formula: front Hz, wheelbase, and a Target Speed slider. Lower speed = softer rear. **OFF** disables the correction |
| **MULTIPLIER** | Rear Hz = front Hz × a multiplier (0.50–3.00). ×1.20 is a common starting point |
| **INDEPENDENT** | Rear Hz set directly (0.80–4.00 Hz), fully decoupled from front |

**Derived info strips** (shown automatically):
- **FRONT / ×ratio / REAR Hz** — live front and rear frequencies with the rear/front multiplier
- **SPR F / SPR R** — computed spring rates in lb/in or N/mm
- **DEF F / DEF R** — static spring deflection in mm under the car's own weight (`g ÷ (2π·Hz)²`). Cross-check that your spring travel isn't bottoming
- **REB · BUMP · SETTLE** — damping ratios and settle time with a category badge: **STIFF** / **SPORT** / **ROAD** / **SOFT** / **FLOAT**

### ANTI-ROLL BARS
- **ARB Bias** — shifts roll stiffness front/rear without changing total stiffness
- **ARB Mode** — Auto (targets natural roll from springs), Roll ° (manual target), or Share % (manual split)
- **ARB Range** — floor/ceiling clamp on clicks. Game limits enforced: Horizon max 65, Motorsport max 40

### ALIGNMENT
Auto mode computes camber, toe, and caster from build type, layout, CG height, and roll angle. Switch to Manual to override.

### BRAKES
- **Auto** — recommends brake balance from front weight bias and build type
- **Manual** — set brake balance (45–70% front) and brake pressure (50–200%) directly. Both affect the entry-phase contribution in the handling balance

### DRIVETRAIN
- Layout (FWD / RWD / AWD) and build type (Street / Track / Drift)
- **Auto** — Corner Exit and Corner Entry sliders shift accel/decel lock without exposing raw percentages
- **Manual** — full control over individual accel/decel lock values per axle

---

## Outputs

### Cards (right panel)
| Card | Contents |
|---|---|
| **Alignment** | Camber F/R, Toe F/R, Caster — enter these in Forza's alignment menu |
| **Anti-Roll Bars** | Front and rear click values. Amber warning at >88% of game limit. Clamp warning if target roll angle is unreachable |
| **Springs** | Front and rear spring rates (lb/in or N/mm). Frequency badge: SOFT / ROAD / FIRM / RACE |
| **Dampers** | Rebound F/R and Bump F/R click values. Amber warning at >88% of game limit |
| **Brakes** | Brake balance (% front) and pressure. FRONT / NEUTRAL / REAR badge |
| **Differential** | Accel and decel lock % (or full AWD breakdown). EXIT/ENTRY balance indicators |

### Handling Balance (pinned)
A persistent bar at the bottom of the output panel showing the combined handling balance across six contributions:

| Segment | What it measures |
|---|---|
| **SPRINGS** | Front/rear spring roll stiffness bias |
| **ARB** | Front/rear anti-roll bar bias |
| **DIFF ACCEL** | Differential exit-phase oversteer/understeer tendency |
| **DIFF DECEL** | Differential entry-phase tendency |
| **BRAKES** | Brake balance entry-phase contribution |
| **AERO** | Aero balance contribution, scaled by downforce level (efficiency) |

The total runs from UNDERSTEER (+) to OVERSTEER (−). **Tune to zero for a neutral baseline**, then bias deliberately if desired. The compact header also shows MECH BALANCE (0.00–1.00, matching Forza's in-game metric) and, when aero is active, the AERO value with a LOW / MED / HIGH downforce badge.

### RAW VALUES strip
Collapsible compact readout: SP F, SP R, ARB F, ARB R, REB F, REB R, BMP F, BMP R.

---

## Tools

### Unit Toggle (IMP / MET)
Header toggle switches weight between **lb / kg** and spring rates between **lb/in / N/mm**. Target speed readout switches between **mph / km/h**. Internal state always stores imperial — codec round-trips are unit-independent.

### Tune Check
Reverse-calculate natural frequency and damping ratios from existing in-game spring and damper values. Useful for verifying a manually-tuned setup or analysing a tune shared by someone else.

### Share / Import
Encodes the full tune (chassis + feel + ARBs + drivetrain + brakes + aero) as a compact Base64 string (~150 chars). Paste into IMPORT on any device running SUSP.OS. Old codes from earlier versions decode safely — new fields default gracefully.

### Save Slots
Six persistent slots arranged in a 2×3 grid, storing feel + drivetrain configuration. Pre-loaded with **STREET**, **TRACK**, **RALLY**, **DRIFT**, **MOTORSPT**, and **COMFORT** presets.

**Car-aware scaling:** each slot stores the corner mass at save time. When loading onto a different-weight car, Ride Stiffness is scaled by `√(savedMass / currentMass)` so the tune maintains the same relative feel rather than applying the raw Hz value.

**Slot controls:**
| Button | Action |
|---|---|
| Slot name | Load tune into current session |
| ✎ | Rename the slot (inline edit) |
| ⓘ | Add/edit notes (shown in hover tooltip; blue when notes exist) |
| ↺ | Overwrite slot with current tune — tap once to arm (turns green), tap again within 2s to confirm |
| ✕ | Clear slot — tap once to arm (turns amber), tap again within 2s to confirm |

**FE / FE+DR toggle** (bottom-left of toolbar): switches between loading feel + drivetrain together (default) and loading feel only, leaving your current drivetrain settings untouched.

**Auto-naming:** new saves are named `BUILD Hz` (e.g. `TRACK 2.14`) from the current build type and front frequency.

### Section Resets
Each sidebar section has a RESET button (two-click confirmation) that restores defaults for that section only.

---

## Aero Balancing Workflow

A tuning method for cars with aero parts:

1. Set all aero to **max cornering** in Forza's tuning menu
2. Read **Aero Balance** (e.g. `0.66`) and **Aero Efficiency** (e.g. `0.42`) from the tuning screen
3. Enter both values in the **CHASSIS** section of SUSP.OS
4. The **AERO** segment in the handling balance now shows how much the aero biases the car
5. Tune springs, ARBs, diff, and brakes until the **total balance reads near zero**
6. The mechanical setup now counteracts the aero — the car is aerodynamically balanced

The efficiency value scales the aero contribution: a car at 0.30 (high downforce) has 3× the aero effect of a car at 0.90 (near stock), so it needs proportionally more mechanical correction.

---

## Calibration

Key empirical constants calibrated from real Forza data:

| Constant | Value | Description |
|---|---|---|
| `ARB_RS_SCALE` | 240 | Maps ARB click → roll stiffness (N·m/rad) |
| `DAMPING_CALIBRATION` | 0.001 | Maps damper click → critical damping coefficient |
| `MECH_BALANCE_STIFFNESS_WEIGHT` | 0.698 | FH blends 70% roll-stiffness balance + 30% weight balance |
| `DIFF_BIAS_SCALE` | 0.08 | Diff lock % → handling bias contribution |
| `BRAKE_BIAS_SCALE` | 0.20 | Brake balance deviation → handling bias contribution |
| `AERO_BALANCE_SCALE` | 15 | Aero balance deviation → handling bias contribution (before efficiency scaling) |

Mechanical balance calibrated across 4 data points on a Lexus LC 500 at ride stiffness 29–75 (1.58–2.83 Hz). Error ±0.004 across all points.

---

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** after first load
- No build step, no Node.js, no dependencies

---

## How It Works

The entire app is a single HTML file containing:
- **Physics engine** — `flatRideRearHz`, `computeTune`, `computeAlignment`, `computeDiff` — pure JS, no React dependency
- **React UI** — in-browser JSX transpilation via `@babel/standalone`
- **Persistence** — `localStorage` via a custom `usePersist` hook; degrades gracefully in private browsing
- **Share codec** — pipe-delimited numeric array, Base64-encoded (41 values, fully backward-compatible)

The physics functions are at the top of the `<script>` block and can be read, tested, or extracted independently. A standalone test suite is included in `tests.js` — run with `node tests.js`.

---

## Development

No build tools required. Open `index.html` in a browser, edit with any text editor, reload to see changes.

```
node tests.js   # run physics unit tests
```

---

## Credits

- Physics foundation: [NumberlessMath](https://forums.forza.net/t/beta-forza-suspension-calculator/97135) (2020)
- Mechanical balance calibration: Forza early access data (4-point LC 500 dataset)

---

## License

MIT
