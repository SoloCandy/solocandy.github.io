# SUSP.OS — BeamNG output mode: plan for Claude Code

> **STATUS: IMPLEMENTED.** Kept for the reasoning, not as a to-do list. The
> shipped behaviour is documented in [PHYSICS.md](PHYSICS.md) ("Physical-unit
> output"), README's BEAMNG mode section, and [CODEC.md](CODEC.md) ("Extending
> an enum"). Where this plan and those docs disagree, the docs are right.
>
> Four corrections found during implementation, recorded so the reasoning below
> isn't taken at face value:
>
> 1. **The function is `solveDampRaw`, not `solveDamp`.** A `solveDamp` existed
>    once and was removed as dead code.
> 2. **"1 lb/in ~ 0.1751 N/mm" (below) is right, and the code is wrong.**
>    `NMM_PER_LBIN` divides by 100 instead of 1000, so every MET-mode spring
>    readout is 10× high. Not fixed here by decision; BeamNG uses a separate
>    correct constant. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
> 3. **CO-SOLVE did not need disabling or a new currency.** `lim.arb` divides
>    both sides of its binary-search comparison and cancels; a nominal
>    `ARB_UTIL_REF` reproduces Horizon's chosen `S` exactly across a 21-point
>    target sweep. The real casualty was **BASIC**, which this plan never
>    mentions — its budget is defined purely as a fraction of the ceiling.
> 4. **The plan misses that `computeTune` recomputes `rsAbF`/`rsAbR` back out of
>    the clamped, rounded click values.** That is deliberate for Forza (the
>    balance bar should show what the game will really do), so physical modes
>    necessarily report slightly different balance figures for identical inputs.
>
> The "15+ call sites" estimate was also low — the real count is ~56 — though
> only about 20 are ceiling logic and the physics seam is genuinely three lines,
> as this plan predicted.
>
> **Two further corrections after seeing BeamNG's actual tuning menu** (a
> screenshot of a stock vehicle's defaults — the first real ground truth this
> work had):
>
> 5. **The units below are wrong.** BeamNG's Spring Rate slider is **N/m**, not
>    N/mm as this plan guessed at line 21 ("N/mm or N/m is the standard
>    convention"), and its Anti-Roll Spring Rate is **N/m — a linear rate**, not
>    the torsional N·m/rad this plan assumed. The first shipped implementation
>    used N/mm and N·m/rad and was corrected. Damping was right (N/m/s ≡ N·s/m).
> 6. **"Most BeamNG suspension setups don't even expose ARB as a slider"
>    (line 22-23) is false** — the sampled vehicle exposes front and rear
>    Anti-Roll Spring Rate. The real ARB problem is different: our converted
>    output is 4–6× softer than that vehicle's stock values, cause unresolved.
>
> The plan also has a genuine gap it never considers: **motion ratio**. Forza
> displays wheel rate, which is what the solver produces; BeamNG's sliders act at
> the spring. Handled with display-only per-axle inputs — see PHYSICS.md.

## Context (why this exists)

SUSP.OS currently targets two `gameMode`s — `horizon` and `motorsport` — both of
which express spring/damper/ARB as **abstract "clicks"** on a fixed universal
scale (`GAME_LIMITS.{horizon,motorsport}.{damping,arb}`: 1-20/1-65 for Horizon,
1-40/1-40 for Motorsport). The click scale exists because Forza hides its real
internal units, so `DAMPING_CALIBRATION` and `ARB_RS_SCALE` were empirically
reverse-engineered (SimHub telemetry, three-car protocol, see
`docs/PHYSICS.md`) to map real physics onto that fake 1-N range.

BeamNG.drive does **not** have an equivalent fixed scale. Its in-game "Tuning"
menu is generated per-vehicle from a `variables` block in that car's Jbeam
config (see BeamNG's own docs:
https://documentation.beamng.com/modding/vehicle/sections/variables/) - the
min/max/units/step you actually see depend on which suspension part/mod is
installed. Confirmed example ranges (from BeamNG's own doc + a third-party
"Fully Adjustable Suspension" mod): damping in **N/m/s**, e.g. bump damping
default 14000, range 500-20000. Spring rate's exact unit wasn't confirmed in
research but N/mm or N/m is the standard convention for this kind of slider.
There is no universal ARB unit either - most BeamNG suspension setups don't
even expose ARB as a slider at all.

**Conclusion from research (do not re-derive/relitigate - already decided in
brainstorming):** BeamNG mode should NOT be a third click-scale like Horizon/
Motorsport. It should skip the click-compression step entirely and output the
**pre-compression real physical values** SUSP.OS already computes internally,
in the same "no game-specific calibration" spirit. This is a *simpler* problem
than Forza was, not a harder one - no new empirical constant needs deriving.

## What SUSP.OS already computes, pre-click (the exploitable seam)

In `computeTune` (`index.html`), the click values are the *last* step, not the
physics itself:

- **Springs**: `solveSpring(hz, mass, motionRatio)` already returns a rate in
  **lb/in** before any Forza-specific step touches it (`springF`/`springR`,
  around line 639-640). Convert to N/mm for BeamNG display
  (1 lb/in ~ 0.1751 N/mm - reuse/derive from existing `LB_IN_TO_NM` if that
  constant is directly usable, or add a small `LB_IN_TO_N_MM` constant;
  confirm which conversion path keeps the fewest redundant constants).

- **Dampers**: `solveDamp`'s pre-scale value is `cc*(z/100)` (critical damping
  fraction) - `DAMPING_CALIBRATION` is applied *after* that
  (`index.html` ~line 245) specifically to compress into Forza's click range.
  For BeamNG, stop before that multiply - the raw `cc*(z/100)` value is
  already in real damping-coefficient units (N.s/m scale, consistent with
  BeamNG's documented N/m/s damping unit) and needs no calibration constant.

- **ARB**: the app's internal roll-stiffness currency (`rsAbF`/`rsAbR`,
  N.m/rad, via `ARB_RS_SCALE*track^2`) is the physically real quantity; the
  `clk()` helper (~line 735) is what compresses that into a 1-`lim.arb` click
  count. BeamNG mode should surface `rsAbF`/`rsAbR` directly (N.m/rad) instead
  of running `clk()`.

## Proposed implementation

1. **Add `beamng` as a third `gameMode` value** alongside `'horizon'`/
   `'motorsport'` (`GAME_MODE_ENC`/`GAME_MODE_DEC`, the two gameMode button
   groups in the header/toolbar UI, `DEF_FE.gameMode` unaffected - default
   stays Horizon).

2. **`GAME_LIMITS.beamng`**: needs a units-only entry, not a range - e.g.
   `{damping:null, arb:null, units:'physical'}` or similar sentinel, since
   there's no 1-N ceiling to clamp against. Decide the exact shape by reading
   how `lim.arb`/`lim.damping` are consumed at each of their ~15+ UI call
   sites (see "Known complexity" below) - many expect a finite number for
   clamping/percentage math (`warn={tune.arbF>lim.arb*0.88}`,
   `Math.min(lim.arb, ...)`), which will break or need a bypass under a null
   limit.

3. **`computeTune`**: add a `gameMode==='beamng'` branch (or an
   `isPhysicalUnits` flag derived from `gameMode`) that:
   - Skips `DAMPING_CALIBRATION` multiply for `rebF`/`rebR`/`bumpF`/`bumpR`,
     returning `cc*(z/100)` directly (rename/alias so it's clear these are
     now N.s/m-scale physical values, not clicks).
   - Skips the `clk()` click-conversion for `arbF`/`arbR`, returning
     `rsAbF`/`rsAbR` (N.m/rad) directly.
   - Springs (`springF`/`springR`) need no change to the solve itself - only
     the **display unit** changes (lb/in -> N/mm), which is a presentation
     concern, not a `computeTune` concern (see step 4).
   - **Important**: `computeTune` currently uses `lim.arb`/`lim.damping` in
     several places *within the solve itself*, not just for display clamping
     (e.g. the CO-SOLVE Auto Spring Share binary search normalizes against
     `lim.arb` as a "click-equivalent currency" - see the large comment block
     around line 573-609). Reusing raw physical roll-stiffness there instead
     of a click-normalized util fraction may change CO-SOLVE's convergence
     behavior. This needs explicit review, not a blind swap - flag to the
     user if CO-SOLVE either needs a BeamNG-specific equivalent-budget concept
     or should simply be disabled/hidden in `beamng` mode.

4. **Display layer**: add a small units-formatting helper (e.g.
   `fmtSpring(lbIn, gameMode)`, `fmtDamp(raw, gameMode)`) used at the
   `Readout`/`Stat` call sites instead of hardcoding `unit="lb/in"` etc., so
   BeamNG mode shows `N/mm`, `N.s/m`, `N.m/rad` instead of `lb/in`,
   `/ {lim.damping}`, `/ {lim.arb}`.

5. **Warnings/clamps tied to `lim.arb`/`lim.damping`** (the `warn={...>
   lim.arb*0.88}` pattern, MAX/FIRM/ROAD/SOFT context labels via `arbCtx`/
   `hzCtx`, the MAN-mode click-entry Fields, the Tune Check modal's ARB/damper
   click inputs) either need a BeamNG-appropriate equivalent (e.g. contextual
   labels based on Hz/roll-angle instead of click-fraction-of-max) or should
   be hidden/disabled in `beamng` mode, since "how close to the game's
   ceiling" is meaningless when there is no ceiling.

## Known complexity / things NOT to hand-wave

- `lim.arb`/`lim.damping` are referenced at **15+ call sites** across
  `computeTune`, the Tune Check modal, hint text, warning thresholds, and the
  MAN-mode manual click Fields - this is not a single isolated branch, it's a
  UI-wide "what does this number mean" change. Budget accordingly; don't
  scope this as "add one if-branch."
- CO-SOLVE's Auto Spring Share explicitly reasons in "ARB-click-equivalents"
  as a deliberately chosen comparable currency between spring and ARB
  contributions (see the long code comment already in the file explaining why
  Hz-distance and Rear Multiplier bands were rejected as that currency). This
  is the single riskiest piece to get right for BeamNG - it may need its own
  physical-currency equivalent (e.g. compare in raw N.m/rad-of-roll-stiffness
  directly, since there's no click ceiling to normalize against) rather than
  a mechanical find-replace of `lim.arb`.
- No new empirical constant is being introduced, so this does **not** need
  the three-car SimHub validation protocol the existing Forza constants went
  through - confirm this stays true; if a BeamNG-specific fudge factor ends
  up necessary anywhere, that's a signal the "just skip click-compression"
  premise broke down somewhere and needs re-examining before shipping.

## Explicitly out of scope for this pass

- Matching a specific car/mod's exact slider min/max/step (user confirmed:
  exploratory, generic physical-unit output is the goal, not scaled-to-a-
  specific-config output).
- Any new calibration constant or in-game validation loop - this is a display/
  unit-conversion change on top of existing, already-validated physics.
- Docs: once implemented, update `docs/PHYSICS.md` (new unit-output note),
  `docs/CODE_MAP.md` (new gameMode branch), and README's game-mode
  description, per `CLAUDE.md`'s standing doc-sync requirement.

## Suggested order of work

1. Confirm the `GAME_LIMITS.beamng` shape and how it interacts with every
   existing `lim.arb`/`lim.damping` call site (read-only investigation pass -
   grep `index.html` for both, enumerate each use, classify as "clamp/ceiling
   logic (needs BeamNG-aware handling)" vs "display-only (needs unit swap)").
2. Implement the `computeTune` branch for springs/dampers/ARB physical output
   (skip `DAMPING_CALIBRATION` and `clk()`), leaving CO-SOLVE's click-
   equivalent logic flagged/disabled for BeamNG until its currency question
   (above) is resolved.
3. Add the display-unit formatting layer and wire gameMode toggle UI.
4. Decide and implement CO-SOLVE's BeamNG-mode behavior (own currency vs
   disabled).
5. Update tests.js if any BeamNG-specific computeTune assertions are worth
   adding (at minimum: verify beamng mode returns unclamped physical values
   matching the pre-click math horizon/motorsport already compute upstream of
   their own calibration step).
6. Docs sync per CLAUDE.md.
