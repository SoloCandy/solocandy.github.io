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

1. **You describe your car** — weight, weight distribution, tyre sizes (and, in PRO, full geometry)
2. **You choose a handling feel** — how stiff, how much body roll, damping character, diff aggression
3. **SUSP.OS computes the physics** — rear spring frequency, critical damping coefficients, roll stiffness budget, alignment geometry
4. **You enter the output values into Forza** — springs, dampers, ARBs, alignment, diff, brakes

The result is a tune that starts from a principled baseline rather than trial-and-error guessing. Fine-tune from there.

---

## Complexity Tiers

A **BEG / INT / PRO** toggle in the header controls how much of the input surface is visible, so the tool scales from a few sliders to full physics control. A short in-app guide opens the first time you enter each tier (reopen any time with the **?** button). Higher tiers gate behind lower ones — finish the BEG guide to unlock INT, the INT guide to unlock PRO.

| Tier | Surface |
|---|---|
| **BEG** (Beginner) | Minimal inputs — layout, build type, weight, front bias, then three feel sliders: **Ride Stiffness**, **Balance** (oversteer ↔ understeer), and **Character** (stable ↔ agile). ARB balance is solved purely from weight distribution — no geometry required. Chassis geometry auto-scales with weight behind the scenes |
| **INT** (Intermediate) | Adds the full input sections — tyre sizes, the Build & Balance Target panel, complete ARB control with the WEIGHT / MECH / CO-SOLVE / MAN balance modes, separate RIDE and DAMPERS sections, and drivetrain intent sliders. Chassis geometry still auto-scales with weight |
| **PRO** | Exposes the complete physics surface — direct geometry inputs (wheelbase, track widths, CG height), the per-wheel load strips, the differential AUTO/MANUAL mode with raw lock percentages, and the MATCH CHASSIS diff option |

Geometry auto-scales with weight in BEG/INT; in PRO you control it directly.

---

## Inputs

The BEG panel is a single streamlined column. INT and PRO expose collapsible sections in this order: **CHASSIS → BUILD & BALANCE TARGET → ANTI-ROLL BARS → RIDE → DAMPERS → DRIVETRAIN**.

### BEG panel

In order, top to bottom:

1. **Layout** — FWD / RWD / AWD
2. **Build** — Street / Track / Drift
3. **Weight** and **Front Weight Bias**
4. **FACTORY presets** — placed *after* the weight inputs, because a preset only applies correctly once your car's weight and bias are entered (see [Builds](#builds))
5. **Ride Stiffness** — SOFT ↔ STIFF, with a SOFT / ROAD / FIRM / RACE badge and the live front Hz. Tick markers on the slider mark the ROAD (1.2 Hz), FIRM (1.8 Hz), and RACE (2.5 Hz) band boundaries, matching the spring dial's colour zones
6. **Balance** — OVERSTEER ↔ UNDERSTEER. Centre is neutral *for your car's weight distribution*; the slider shifts the rear roll-stiffness target away from that neutral point
7. **Character** — STABLE ↔ AGILE. Adjusts rebound damping and bump ratio together: STABLE = more damped and planted, AGILE = lighter and livelier
8. **RESET** (two-tap to confirm) — restores the whole tune to first-open defaults

### CHASSIS

| Field | Tier | Description |
|---|---|---|
| Weight | all | Total vehicle weight (lb or kg) — from Forza's car stats screen |
| Front Weight Bias | all | % weight on the front axle |
| Tyre sizes | INT/PRO | Front/rear tyres in Forza format (e.g. `265/35R18`). The **width** (first number, mm) sets each axle's grip capacity at the limit — wider = more grip on that end, feeding the **GRIP BIAS** readout. Aspect ratio and rim diameter set rolling radius. Width affects grip balance, not the roll-stiffness fraction |
| Wheelbase | PRO | Axle-to-axle distance in mm |
| Track Width Front / Rear | PRO | Left-to-right wheel distance per axle — affects lateral weight transfer and ARB calculations |
| CG Height | PRO | Centre-of-gravity height in mm |

**Chassis readouts** (shown in INT/PRO below the tyre inputs):
- **CHASSIS BAL.** — the car's natural roll-stiffness rear fraction from geometry and weight alone, with an OS / NEUTRAL / US tag
- **GRIP BIAS** — the physical at-limit handling tendency from the tyre-load-sensitivity model (distinct from the roll-stiffness balance)
- **STABILITY** — an AGILE / BALANCED / STABLE / PLANTED index from the wheelbase-to-track ratio
- **Track recommendation panel** — when your balance target is far from the chassis natural balance, suggests front/rear track-width changes (with feasibility marks) to help reach it

**Per-wheel load strips** (PRO only, below weight/bias):
- **F CORNER / R CORNER** — per-wheel corner mass at rest
- **XFER F / XFER R** — lateral weight transfer per g of cornering, per axle
- **OUT F / OUT R** — outer wheel load at 1g cornering
- **IN F / IN R** — inner wheel load at 1g cornering

### BUILD & BALANCE TARGET (INT/PRO)

- **Build Type** — Street / Track / Drift. Shifts ARB and differential recommendations, brake balance AUTO, and the recommended balance-target range
- **Mech Balance Target** — your overall handling-balance goal (0.40–0.90, where 0.50 ≈ neutral roll resistance, higher = more rear roll stiffness / more rotation). Used by the MECH and CO-SOLVE ARB modes, the MECH rear Hz mode, and (optionally) the diff MATCH CHASSIS feature. FH6 surfaces this value in-game so you can verify it directly; on older titles (FH5, FM, etc.) the solver still targets the same physics — you just won't see it reflected in the tuning menu
- **Balance Guide** — a band chart showing your chassis **NATURAL** balance (Δ=0 baseline), the recommended **RANGE** for your layout and build type, and your current **TARGET** with its deviation from natural

### ANTI-ROLL BARS (INT/PRO)

- **ARB dial** — live front/rear click values and roll-stiffness split. Hollow rings on the arc mark where the derived axle would need to sit for **natural balance** (grey) and your **target** (green), using the same logic as the spring dial. Hover a dot to read its click value
- **ARB Mode** — how the total ARB budget is *sized*: **Auto** (targets the natural roll from springs), **Roll °** (manual body-roll target), or **Share %** (manual ARB fraction of total roll stiffness)
- **ARB Range** — floor/ceiling clamp on clicks. Game limits enforced: Horizon max 65, Motorsport max 40
- **ROLL readout** — predicted body-roll angle at 1g, with a tilt indicator

**Balance Mode** — how the front/rear split is chosen to hit your handling goal:
| Mode | Behaviour |
|---|---|
| **WEIGHT** | Splits ARBs by weight distribution, with an optional **ARB Bias** slider to shift roll stiffness front/rear |
| **MECH** | Solves the ARB split to hit the **Mech Balance Target** exactly. The resulting **ARB SPLIT** front/rear % is shown. *(This is the mode BEG uses, anchored to weight distribution.)* |
| **CO-SOLVE** | Solves rear spring stiffness **and** ARB split together. A **SPRING SHARE** slider controls how much of the correction comes from springs vs ARBs. The solved rear frequency appears as **SOLVED REAR Hz**, and the rear Hz mode selector is hidden (rear Hz is solved automatically) |
| **MAN** | Direct manual input of front and rear ARB click values. When switching into MAN, the current solved values are pre-filled. Useful for calibration testing — enter your real in-game values and observe the calculator's predicted mech balance |

### RIDE (INT/PRO)

| Control | Description |
|---|---|
| **Spring dial** | Live front/rear frequencies on an arc coloured by frequency band (SOFT / ROAD / FIRM / RACE at 1.2 / 1.8 / 2.5 Hz). Hollow rings on the arc mark where the **derived axle** would need to sit for **natural balance** (grey) and your **mech balance target** (green) — the gap to green shows how far the spring split is from your target. Hover a dot to read its Hz value |
| **Ride Ref.** | Which axle the stiffness slider anchors to: **FRONT** (default), **SHARED** (slider sets the average of both axles), or **REAR**. Switching never changes the actual frequencies — it just moves which axle the slider follows. Works in CO-SOLVE too |
| **Ride Stiffness** | Spring frequency slider, 0.80–5.50 Hz. Click the Hz readout to type a target frequency directly. ROAD / FIRM / RACE tick markers (at 1.2 / 1.8 / 2.5 Hz) mark the band boundaries shared with the spring dial |
| **Hz Mode** | How the derived axle's frequency relates to the anchored one (hidden in CO-SOLVE) |
| Secondary slider | Depends on the Hz Mode — a Target Speed slider (FLAT RIDE), a manual rear/front Hz value (INDEPENDENT), or a solved-Hz readout (MECH) |

**Hz Modes:**
| Mode | Behaviour |
|---|---|
| **FLAT RIDE** | Derived axle's Hz comes from the flat-ride formula: anchored Hz, wheelbase, and a Target Speed slider. Lower target speed = softer rear. **OFF** disables the correction |
| **MULTIPLIER** | Derived Hz = anchored Hz × a multiplier (0.50–3.00). ×1.20 is a common starting point |
| **MECH** | Solves the rear/front Hz ratio from the Mech Balance Target so the springs themselves carry the balance |
| **INDEPENDENT** | Derived axle's Hz set directly (0.80–5.50 Hz), fully decoupled. Not available in SHARED ref |

**RIDE readouts:** a **FRONT · ×ratio · REAR Hz** strip and a **SPR F / SPR R** spring-rate strip (lb/in or N/mm).

### DAMPERS (INT/PRO)

| Control | Description |
|---|---|
| **Damping dial** | Live rebound (red) and bump (blue) damping ratios on an arc from 10–115%. Center displays the bump-to-rebound ratio. Fill between the dots turns amber if bump exceeds rebound. Hover a dot to read its value |
| **Damping Mode** | **BUMP RATIO** (bump as a % of rebound) or **INDEPENDENT** (bump ζ set separately) |
| **Rebound ζ** | Damping ratio for the rebound stroke, 10–115%. Tick markers: **40%** = underdamping threshold (blue), **70%** = Butterworth (amber), **100%** = overdamped (red) |
| **Bump Ratio / Bump ζ** | Bump damping, as a ratio of rebound or an independent ratio depending on the mode. Bump Ratio tick markers: **30%** = underdamping threshold (blue), **65%** = firm (amber). Bump ζ shares the same three markers as Rebound ζ |
| **Settle Sync** | Toggle (ON/OFF). When ON, replaces Damping Bias with a **Settle Bias** slider and matches front/rear settle time: the ride-reference axle holds your Rebound ζ and the other axle's ζ is derived so both settle in the same time. Settle Bias skews the split — FRONT = front settles faster, REAR = rear settles faster |
| **Damping Bias** | (Settle Sync OFF) Biases damping toward one axle by softening the opposite side. FRONT = rear gets softer (more rotation); REAR = front gets softer (more entry compliance). Shows as the **DAMP** row in the handling balance |

**DAMPERS readout:** a **REB · BUMP · SETTLE** strip with a settle-time category badge — **STIFF / SPORT / ROAD / SOFT / FLOAT**. When a bias is active, it splits into front/rear columns.

### DRIVETRAIN

- **Layout** — FWD / RWD / AWD
- **Differential Mode** (PRO) — **AUTO** derives lock values from layout, build type, weight bias, and the intent sliders; **MANUAL** exposes every individual lock percentage directly
- **Intent sliders** (all tiers) — **EXIT** and **ENTRY** shift accel/decel lock without exposing raw percentages. AWD adds a **POWER SPLIT** (center torque) slider and a **FRONT EXIT** slider (INT/PRO)
- **Match Chassis** (PRO, AUTO mode only) — biases the diff's exit/entry intent toward the chassis Mech Balance Target, so the differential reinforces the handling balance you set elsewhere. Capped so it can't override explicit slider input

---

## Outputs

### Cards (right panel)

Shown in this order:

| Card | Contents |
|---|---|
| **Alignment** | Camber F/R, Toe F/R, Caster — always computed automatically |
| **Anti-Roll Bars** | Front and rear click values. Amber warning near the game limit. Clamp warning if a target roll angle is unreachable |
| **Springs** | Front and rear spring rates (lb/in or N/mm). Frequency badge: SOFT / ROAD / FIRM / RACE |
| **Dampers** | Rebound F/R and Bump F/R click values. Amber warning near the game limit |
| **Brakes** | Brake balance (% front) and pressure. FRONT / NEUTRAL / REAR badge. Always computed automatically |
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

The header shows **MECH BALANCE** (0.00–1.00, matching Forza's in-game roll-stiffness metric). When the physical at-limit tendency diverges from neutral, a **GRIP BIAS** note appears — derived from the tyre-load-sensitivity model, reflecting how the chassis behaves at the limit, as distinct from the roll-stiffness mech balance.

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

## Header & Tools

### Header controls

- **☰** — open/close the input sidebar
- **IMP / MET** — switch weight between **lb / kg**, spring rates between **lb/in / N/mm**, and the Target Speed readout between **mph / km/h**. Internal state always stores imperial; codec round-trips are unit-independent
- **HORIZON / MOTORSPORT** — switch output limits between the two titles (ARB and damper click ceilings differ: Horizon ARB 65 / damper 20, Motorsport ARB 40 / damper 40)
- **BEG / INT / PRO** — complexity tier
- **↩ (Undo)** — undo the last change
- **?** — reopen the guide for the current tier
- **Zoom (− % +)** — scale the whole UI from 70% to 160% (hidden on phone portrait, which renders at native 1.0×)

### Tune Check

Reverse-calculate natural frequency and damping ratios from existing in-game spring and damper values. Useful for verifying a manually-tuned setup or analysing a tune shared by someone else.

### DATA (Share / Import / Export)

The **DATA** button opens a unified modal with a mode selector at the top:

**SHARE — generate a tune code**
Encodes chassis, feel, and/or drivetrain as a compact Base64 string (~210 chars). Choose which sections to include via checkboxes before copying. Paste the code into IMPORT on any device running SUSP.OS. Old codes from earlier versions decode safely — new fields default gracefully. Brake and alignment values are computed outputs and are not included in share codes.

**IMPORT — load from a tune code**
Paste a tune code and choose which sections to apply (CHASSIS, FEEL, DRIVETRAIN) via checkboxes before loading.

**EXPORT — back up saved data**
Downloads a `suspos-data.json` file containing your GARAGE saves, MY BUILDS saves, or both. Use this to transfer data between browsers or devices.

### Garage

Persistent chassis saves, accessible from the CHASSIS section of the sidebar. Each save stores the full chassis — weight, bias, tyre sizes, wheelbase, track widths, and CG height. The **OVERWRITE** button (top-left of each card, two-tap to confirm) updates a slot in place without deleting it.

### Builds

Persistent tune saves in the BUILDS drawer (and, in BEG, the FACTORY drawer below the weight inputs).

- **FACTORY** — six read-only presets: STREET, TRACK, RALLY, DRIFT, MOTORSPT, X COUNTRY. Each loads feel + drivetrain settings tuned for that use case. Because the presets solve against your car's weight and bias, **enter those first, then load a preset.** In BEG, loading a preset anchors the ARB balance to your car's weight distribution
- **MY BUILDS** — user-created saves. Name a build and press SAVE; each card shows build type and save date. The **OVERWRITE** button (two-tap to confirm) updates a saved build with the current tune without deleting it

Loading a build (FACTORY or MY BUILDS) always applies both feel and drivetrain settings.

### Resets

- **BEG** — a single **RESET** button (two-tap to confirm) restores the whole tune to first-open defaults
- **INT/PRO** — each sidebar section has its own **RESET** button (two-tap to confirm) that restores defaults for that section only

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

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** after first load
- No build step, no Node.js, no dependencies

### Responsive layout

The UI adapts at two breakpoints:

- **< 768px (tablet/phone):** the input sidebar becomes a slide-out drawer (☰ toggle, tap-outside to close); the unit/game-mode and BEG/INT/PRO controls move out of the header into their own rows.
- **< 480px (phone portrait):** the page renders at native 1.0× zoom (the zoom controls are hidden), the ANTI-ROLL BARS and SPRINGS cards stack vertically, number inputs shrink to fit, and the pinned **Handling Balance** footer collapses to a single summary line (oversteer value + tendency + mech balance) — tap it to expand the full Balance / Response bars, then **CONTRIBUTIONS** for the contributor breakdown and actionable tip.

The header and pinned footer respect device safe areas (`env(safe-area-inset-*)`), so they clear the notch and home indicator on modern phones. The layout is sized with the dynamic viewport unit (`100dvh`), so the pinned footer stays visible as the mobile browser's address bar collapses and expands rather than being hidden behind it.

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

## Credits

- Physics foundation: [NumberlessMath](https://forums.forza.net/t/beta-forza-suspension-calculator/97135) (2020)
- Mechanical balance calibration: Forza early access data (4-point LC 500 dataset)

---

## License

MIT
