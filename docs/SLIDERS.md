# SUSP.OS — Slider Reference

Every slider in the app: its range, which tier exposes it, what it does
physically, and its effect on handling balance (oversteer/understeer).

Balance direction is sourced from the authoritative `bXxx` contributor
formulas in `index.html` (`bSp`, `bAb`, `bDampBias`, `bDiffAccel/Decel/
Front/Rear`, `bBrakeEntry`), not slider hint text alone — hint text has
been wrong at least once (Damping Bias) relative to the actual formula.

Convention across the app: **right = OVERSTEER, left = UNDERSTEER** for
every balance-relevant slider.

> Keep this in sync with `index.html` whenever a slider's range, mechanism,
> or tier gating changes — see the note in `CLAUDE.md` about reviewing docs
> after major changes.

---

## Beginner (BEG) — always visible

| Slider | Range | Effect | Balance Direction |
|---|---|---|---|
| Ride Stiffness | 0.8–5.5 Hz | Sets front spring frequency; rear derives via active Hz mode | None directly — magnitude only |
| Balance | −50..+50 | Blends NEUTRAL-mode ARB Bias (dominant) with a slight rear/front Hz ratio nudge, applied incrementally on top of whatever ratio is already set (e.g. a loaded preset's), not a reset | Right = OVERSTEER, Left = UNDERSTEER |
| Character | −50..+50 | Sets rebound ζ and bump ratio | None — damping feel (STABLE↔AGILE) |
| Layout | FWD/RWD/AWD | Drivetrain type; reshapes diff behavior and natural balance | Indirect — redefines "neutral" |
| Weight | 100–18,000 lb | Scales spring rates, damper forces, ARB stiffness | None directly |
| Front Weight Bias | 30–70% | Front axle weight fraction | Higher front % → naturally more understeer-prone |
| Build Type | Street/Track/Drift/Rally/Offroad/Drag | Shifts alignment, diff AUTO behavior, brake balance, recommended targets | Indirect (changes recommendations) |

## Intermediate (INT) — adds these

| Slider | Range | Effect | Balance Direction |
|---|---|---|---|
| ARB Bias | −50..+50 | Shifts front/rear ARB split (WEIGHT: from weight default; NEUTRAL: from the springs-cancelling point; CHASSIS (PRO): from the car's natural mech balance) | Right = OVERSTEER, Left = UNDERSTEER |
| Split Direction (WEIGHT/CHASSIS) | SAME / OPPOSITE | SAME tracks the reference balance directly (front-heavy → front-heavy ARB). OPPOSITE mirrors the split around 50/50 (front-heavy → rear-heavy ARB), so the bars counteract the reference instead of following it. ARB Bias still nudges from whichever baseline this picks. | Indirect — flips which side WEIGHT/CHASSIS lean toward by default |
| Rebound ζ | 10–115% | Rebound damping ratio, both axles | None — magnitude/feel |
| Bump Ratio | 10–100% | Bump damping as % of rebound | None — feel only |
| Bump ζ | 10–115% | Independent bump damping | None — feel only |
| Damping Bias | −50..+50 | Softens the opposite axle from the biased one, up to 50% | Right (REAR bias) = OVERSTEER, Left (FRONT bias) = UNDERSTEER |
| Settle Target | 0.10–2.00s | Target settle time; back-solves rebound ζ | None directly |
| Settle Bias | −50..+50 | Biases which axle settles faster | Right (REAR) = OVERSTEER-leaning, Left (FRONT) = UNDERSTEER-leaning |
| Rear/Front Multiplier | 0.50–3.00× | Secondary axle Hz as ratio of anchor | Higher → OVERSTEER-leaning, lower → UNDERSTEER-leaning |
| Independent Hz | 0.8–5.5 Hz | Manual secondary-axle Hz | Stiffer axle resists roll more there |
| Target Speed | 40–180 mph | Flat Ride phase-cancelling speed target | None directly |
| Diff Type | Race/Sport/Rally/Offroad/Drift | Lock-curve aggressiveness scaling | Indirect (scales EXIT/ENTRY) |
| EXIT | −50..+50 | Accel-lock intent (sign-flipped for FWD so right always leans OS) | Right = OVERSTEER-leaning |
| ENTRY (not SPORT) | −50..+50 | Decel-lock intent | Right = OVERSTEER-leaning |
| FRONT EXIT (AWD) | −50..+50 | Front-axle accel lock | Left (PUSH) = more UNDERSTEER |
| POWER SPLIT (AWD) | −30..+30 (20–80% rear) | Center torque split | Right (REAR) = OVERSTEER |

## Pro (PRO) — adds these

| Slider | Range | Effect | Balance Direction |
|---|---|---|---|
| Wheelbase | 400–4,000mm | Flat-ride Hz solve, brake balance | None directly |
| Track Width F/R | 1,000–2,600mm | Roll-stiffness lever arm; feeds natural mech balance | Wider front → understeer lean; wider rear → oversteer lean |
| CG Height | 200–900mm | Roll moment arm | None directly |
| Tyre Size F/R | e.g. `265/35R18` | Grip capacity; asymmetry nudges displayed Mech Balance | Wider rear → less oversteer; wider front → less understeer |
| Mech Balance Target | delta from NAT (≈−0.35..+0.70) | MECH/CO-SOLVE solve to `naturalMechBalanceOf(ch) + delta` | Positive = OVERSTEER target, negative = UNDERSTEER target |
| Balance Offset | −0.20..+0.20 | GRIP mode's offset from grip-neutralizing target | Positive = OVERSTEER, negative = UNDERSTEER |
| ARB F / ARB R (Stiffness Mode MAN) | 1–65 clicks | Direct ARB click values, bypasses budget/split entirely | More rear-relative → OVERSTEER |
| Spring Share (CO-SOLVE) | 0–100% | Splits correction between spring Hz and ARB split | None directly — redistributes *how*, not the target |
| Accel/Decel Lock (MANUAL diff) | 0–100% each | Direct per-axle lock % | Rear lock → OVERSTEER; front lock → UNDERSTEER |
| Center Split (MANUAL AWD) | 0–100% rear | Direct torque split | Higher % rear → OVERSTEER |
| Nudge Strength (Alignment MECH/GRIP) | 0–100% | Scales how far camber/toe are nudged from the BUILD baseline toward the MECH/GRIP gap (see [ALIGNMENT.md](ALIGNMENT.md)) | 0% = no nudge (identical to BUILD); direction comes from the gap's sign, not this slider |
| Camber F/R, Toe F/R, Caster (Alignment MANUAL) | Camber −4.0/−3.5..0.0°, Toe −0.20..0.15° / 0.0..0.25°, Caster 4.0–7.5° | Direct entry, bypasses `computeAlignment` entirely | None directly — whatever you type |

## Auto-computed by default, or PRO's Alignment Mode

BRAKES (balance %, pressure %) is always fully computed from build type/
layout/weight bias/chassis geometry, with no manual override. ALIGNMENT
(camber, toe, caster) is computed the same way by default (BUILD mode), but
PRO mode adds an Alignment Mode toggle (BUILD/MECH/GRIP/MANUAL) — see the
Nudge Strength/Camber/Toe/Caster rows above and
[ALIGNMENT.md](ALIGNMENT.md) for the full reference.
