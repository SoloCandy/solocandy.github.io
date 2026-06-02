# SUSP.OS — Forza Suspension Calculator

A single-file suspension tuning calculator for **Forza Horizon** and **Forza Motorsport**. Enter your car's physical stats and a handling target — SUSP.OS outputs exact in-game click values for springs, dampers, anti-roll bars, alignment, brakes, and differential, all grounded in real suspension physics.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://forums.forza.net/t/beta-forza-suspension-calculator/97135)

---

## Quick Start

Download `index.html` and open it in any browser. No install, no server, no build step.

> **Offline note:** React and Babel load from a CDN on first use. Once cached, the app works fully offline. For a fully air-gapped setup, open it once with internet access, then it works without a connection.

---

## What It Does

Forza's suspension tuning menus expose raw numbers (spring rate lb/in, damper clicks, ARB clicks) with no guidance on what those numbers mean physically. SUSP.OS bridges that gap:

1. **You describe your car** — weight, weight distribution, wheelbase, CG height, tyre sizes
2. **You choose a handling feel** — how stiff, how much body roll, damping character, diff aggression
3. **SUSP.OS computes the physics** — flat-ride rear frequency, critical damping coefficients, roll stiffness budget, alignment geometry
4. **You enter the output values into Forza** — springs, dampers, ARBs, alignment, diff, brakes

The result is a tune that starts from a principled baseline rather than trial-and-error guessing. Fine-tune from there.

---

## Complexity Tiers

A **BEG / INT / PRO** toggle in the header controls how much of the input surface is visible, so the tool scales from one-slider simplicity to full physics control. A short in-app guide opens the first time you enter each tier (reopen any time with the **?** button).

| Tier | Surface |
|---|---|
| **BEG** (Beginner) | Minimal inputs — weight, a handling-feel slider, and a balance target. Chassis geometry auto-scales with weight, and CO-SOLVE is selected automatically so springs and ARBs are solved together |
| **INT** (Intermediate) | Adds full springs/damping/ARB control with the WEIGHT / MECH / CO-SOLVE / MAN balance modes, without requiring chassis geometry |
| **PRO** | Exposes the complete physics surface — geometry inputs, manual alignment, raw differential lock percentages, brake balance, the Balance Guide panel, and cross-solver readouts |

Geometry auto-scales with weight in BEG/INT; in PRO you control it directly.

---

## Inputs

### CHASSIS
| Field | Description |
|---|---|
| Weight | Total vehicle weight (lb or kg) — from Forza's car stats screen |
| Front Weight Bias | % weight on the front axle |
| Wheelbase | Axle-to-axle distance in mm |
| CG Height | Centre-of-gravity height in mm |
| Track widths | In the Advanced section — affect lateral weight transfer and ARB calculations |
| Tyre sizes | Front/rear tyres in Forza format (e.g. `265/35R18`). The **width** (first number, mm) sets each axle's grip capacity at the limit — wider = more grip on that end, which feeds the **GRIP BIAS** readout. Aspect ratio and rim diameter set rolling radius. Width affects grip balance, not the roll-stiffness fraction |

**Derived info strips** (shown automatically below inputs):
- **F CORNER / R CORNER** — per-wheel corner mass at rest
- **XFER F / XFER R** — lateral weight transfer per g of cornering, per axle (corner mass × CG height ÷ track width)
- **OUT F / OUT R** — outer wheel load at 1g cornering (corner mass + transfer)
- **IN F / IN R** — inner wheel load at 1g cornering (corner mass − transfer)

### FEEL
| Field | Description |
|---|---|
| Ride Stiffness | Spring frequency slider, 0.80–5.50 Hz. Click the Hz readout to type a target frequency directly. Green **ROAD** and **RACE** tick marks show the typical band for this car's corner weight — lighter cars sit higher on the scale |
| Ride Ref | Which axle the stiffness slider anchors to: **FRONT** (default), **SHARED** (both axles move together around the slider as the average), or **REAR**. The opposite axle is then derived by the Rear Hz mode |
| Rear Hz mode | Controls how the derived axle's frequency relates to the anchored one |
| Rebound ζ | Damping ratio for the rebound stroke. 70% = Butterworth (critically tuned). >100% = overdamped |
| Bump | Either a ratio of rebound (BUMP RATIO mode) or independent ζ (INDEPENDENT mode) |
| Damping Bias | Splits front/rear ζ independently. Positive = more front rebound (resists forward weight transfer → understeer tendency). Shows as the **DAMP** row in the handling balance |

**Rear Hz modes:**
| Mode | Behaviour |
|---|---|
| **FLAT RIDE** | Derived axle's Hz comes from the flat-ride formula: anchored Hz, wheelbase, and a Target Speed slider. Lower speed = softer rear. **OFF** disables the correction |
| **MULTIPLIER** | Derived Hz = anchored Hz × a multiplier (0.50–3.00). ×1.20 is a common starting point |
| **MECH** | Solves the rear/front Hz ratio from the Mech Balance Target so the springs themselves carry the balance |
| **INDEPENDENT** | Rear Hz set directly (0.80–5.50 Hz), fully decoupled from front |

> In **CO-SOLVE** ARB balance mode the rear Hz is solved automatically (springs + ARBs together), the mode selector is hidden, and the result appears as **SOLVED REAR Hz** in the ARB section.

**Derived info strips** (shown automatically):
- **FRONT / ×ratio / REAR Hz** — live front and rear frequencies with the rear/front multiplier
- **SPR F / SPR R** — computed spring rates in lb/in or N/mm
- **DEF F / DEF R** — static spring deflection in mm under the car's own weight (`g ÷ (2π·Hz)²`). Cross-check that your spring travel isn't bottoming
- **REB · BUMP · SETTLE** — damping ratios and settle time with a category badge: **STIFF** / **SPORT** / **ROAD** / **SOFT** / **FLOAT**

### BUILD
- **Build Type** — your intended use case (Street / Track / Drift). Determines recommended balance range, diff AUTO behavior, alignment presets, and brake AUTO recommendations
- **Mech Balance Target** — your overall handling-balance goal (0.40–0.90, where 0.5 ≈ neutral, higher = more rear roll stiffness / more rotation). Used by MECH, CO-SOLVE, the MECH rear Hz mode, and (optionally) the diff MATCH CHASSIS feature. Set this first; it drives everything: ARB split, spring stiffness, alignment, and diff bias
- **Balance Guide** panel — shows your chassis natural balance, recommended target range for your build type, and how far your current target deviates from natural

### ANTI-ROLL BARS
- **ARB Mode** — how the total ARB budget is sized: Auto (targets natural roll from springs), Roll ° (manual target), or Share % (manual split of total roll stiffness)
- **ARB Range** — floor/ceiling clamp on clicks. Game limits enforced: Horizon max 65, Motorsport max 40

**Balance Mode** — how the front/rear split is chosen to hit your handling goal:
| Mode | Behaviour |
|---|---|
| **WEIGHT** | Splits ARBs by weight distribution, with an optional **ARB Bias** offset to shift roll stiffness front/rear |
| **MECH** | Solves the ARB split to hit the **Mech Balance Target** exactly. The resulting **ARB SPLIT** front/rear % is shown |
| **CO-SOLVE** | Solves rear spring stiffness **and** ARB split together. **Spring / ARB Mix** (Spring Share) controls how much of the correction comes from springs vs ARBs |
| **MAN** | Direct manual input of front and rear ARB click values. When switching into MAN mode, the current solved ARB values are pre-filled as a starting point. Useful for isolated ARB calibration testing — enter your real in-game values and observe the calculator's predicted mech balance |

### ALIGNMENT
Auto mode computes camber, toe, and caster from build type, layout, CG height, and roll angle. Switch to Manual to override.

### BRAKES
- **Auto** — recommends brake balance from front weight bias and build type
- **Manual** — set brake balance (45–70% front) and brake pressure (50–200%) directly. Both affect the entry-phase contribution in the handling balance

### DRIVETRAIN
- **Layout** — FWD / RWD / AWD
- **Auto** — Corner Exit and Corner Entry sliders shift accel/decel lock without exposing raw percentages. AWD adds a Center split slider and a front exit-push slider
- **Manual** — full control over individual accel/decel lock values per axle
- **Match Chassis** — optional toggle (auto mode only) that biases the diff's exit/entry intent toward the chassis Mech Balance Target, so the differential reinforces the handling balance you set elsewhere. Capped so it can't override explicit slider input

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
A persistent bar at the bottom of the output panel showing the combined handling balance across every contribution. The contributor bars are **sorted by magnitude** — the dominant driver appears first and is visually highlighted:

| Segment | What it measures |
|---|---|
| **SPRINGS** | Front/rear spring roll stiffness bias |
| **ARB** | Front/rear anti-roll bar bias |
| **DIFF EXIT / DIFF ENTRY** | Differential on-throttle exit and off-throttle entry tendency (FWD/RWD) |
| **DIFF F / DIFF R** | AWD per-axle net diff contribution, split by center fraction and axle weight (replaces EXIT/ENTRY in AWD) |
| **BRAKES** | Brake balance entry-phase contribution |
| **DAMP** | Damping Bias contribution — front/rear rebound split |

The total reads as OVERSTEER (+) or UNDERSTEER (−). **Tune to zero for a neutral baseline**, then bias deliberately if desired. Below the bars, a one-line tip names the dominant contributor and suggests a concrete adjustment.

The header shows **MECH BALANCE** (0.00–1.00, matching Forza's in-game roll-stiffness metric). When the physical at-limit tendency diverges from neutral, a **GRIP BIAS** note appears — derived from the tyre-load-sensitivity model and reflecting how the chassis behaves at the limit (an understeer- or oversteer-prone chassis), as distinct from the roll-stiffness mech balance.

### Response Bar
A second bar below the Handling Balance showing where the setup sits on a **PLANTED ↔ REACTIVE** axis. This reflects **transient response character** — how quickly and freely the car responds to steering inputs. ARBs and weight bias are intentionally excluded: they govern roll moment distribution (already captured by the Handling Balance bar), not response speed.

| Contributor | Weight | Direction |
|---|---|---|
| Spring Hz | 50% | Higher frequency → more reactive (faster natural response) |
| Damping ζ | 20% | Lower damping → more reactive (less resistance to roll initiation) |
| Front toe | 15% | Less toe-in → more reactive (sharper turn-in) |
| Caster | 10% | Less caster → more reactive (lighter steering, less self-centering) |
| Rear/front Hz ratio | 5% | Higher ratio → more reactive (rear-biased stiffness = more rotation) |

Centre of the bar is balanced. Left (green) = planted and settled. Right (amber) = reactive and quick to respond.

> Note: the Response bar reflects *feel*, not lap time. A planted setup can be fast; a reactive setup can be difficult to manage. Use it alongside Handling Balance to understand the character of your tune.

---

## Tools

### Unit Toggle (IMP / MET)
Header toggle switches weight between **lb / kg** and spring rates between **lb/in / N/mm**. Target speed readout switches between **mph / km/h**. Internal state always stores imperial — codec round-trips are unit-independent.

### Tune Check
Reverse-calculate natural frequency and damping ratios from existing in-game spring and damper values. Useful for verifying a manually-tuned setup or analysing a tune shared by someone else.

### Share / Import
Encodes the full tune (chassis + feel + ARBs + drivetrain + brakes) as a compact Base64 string (~210 chars). Paste into IMPORT on any device running SUSP.OS. Old codes from earlier versions decode safely — new fields default gracefully.

### Save Slots
Six persistent slots arranged in a 2×3 grid, storing feel + drivetrain configuration. Pre-loaded with **STREET**, **TRACK**, **RALLY**, **DRIFT**, **MOTORSPT**, and **X COUNTRY** presets.

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

**Mechanical balance accuracy:**

Mechanical balance (the **MECH BALANCE** readout) is the roll-stiffness rear fraction, matching the metric Forza displays. The calculator's prediction includes tire-width correction via `TIRE_MECH_SCALE`. 

For **asymmetric tires** (different widths front/rear), the correction typically brings error down to **±0.02**.

For **symmetric tires** (same width front/rear), a small residual offset remains (**±0.01 to ±0.04**, larger for extreme setups with very soft springs + high ARBs). This is not an ARB_RS_SCALE error — springs contribute 88%+ of total roll stiffness, so scaling adjustments have negligible effect on the mechBalance ratio. The residual reflects Forza's incorporation of minor load-sensitivity and motion-ratio effects not captured in the simplified roll-stiffness-only model. Use the **MAN mode** to directly input your real in-game ARB values and verify the calculator against Forza's actual reading.

The physical at-limit tendency (**GRIP BIAS**) is derived separately from a lateral-load-transfer model: front/rear load transfer set by the roll-stiffness ratio, tyre load sensitivity (`TIRE_LOAD_SENS`), and tyre width as a sub-linear grip multiplier (`WIDTH_GRIP_EXP`). The two are reconciled by bisection so a balance target round-trips to the spring/ARB split that achieves it.

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
- **Share codec** — pipe-delimited numeric array, Base64-encoded (~210 chars, 54 values, fully backward-compatible — short legacy codes decode with new fields defaulted)

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
