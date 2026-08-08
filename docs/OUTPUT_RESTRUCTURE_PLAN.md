# SUSP.OS — Output section restructure (Forza mode): plan for Claude Code

## Context / goal

The output panel (`index.html`, `#zone-output`, the six cards from ALIGNMENT
through DIFFERENTIAL) currently mirrors Forza's own tuning-menu tab order
(per CLAUDE.md's documented convention) but renders each value inside a
bordered mini-card with a header, (i) hint icon, sub-labels, and context
badges. On wide viewports this produces large unused margins (cards capped
at `maxWidth:1400` in narrow fixed columns) and, per-value, more chrome than
a "read it, type it into the game" checklist needs.

Diagnostic/analysis content (HANDLING BALANCE bar, MECH BALANCE, RESPONSE)
already lives in its own footer section, separate from the output cards —
confirmed, not part of this change. This plan is scoped **only** to the
output cards themselves, and **only** to Forza mode (`gameMode` `horizon`/
`motorsport`). A separate, related restructure for BeamNG physical-unit mode
(reordering by physical-subsystem confidence rather than Forza menu order)
was discussed earlier and is an explicit follow-up, not part of this pass —
do not conflate the two.

Source: hand-drawn wireframe from the user (attached to this doc's origin
conversation — recreate the row/field structure below; the wireframe is the
spec for layout intent, this doc is the spec for which fields are real, which
are new placements of existing data, and which known branches must be
preserved).

## Layout principle

Replace bordered per-value mini-cards with full-width single rows (or paired
rows where two related values sit together, e.g. Camber F / Camber R). Drop
per-item chrome that doesn't serve "scan and type": no per-value (i) hint
icon, no per-value colored context badge as a separate box — inline text
instead. Section-level hints (one per card, not one per value) are fine and
already exist as the `hint=` prop pattern on `Card`.

## Section-by-section spec

### ALIGNMENT
Paired rows: Camber F / Camber R together, Toe F / Toe R together, Caster
alone. Values: `align.recCamberF`, `align.recCamberR`, `align.recToeF`,
`align.recToeR`, `align.recCaster` — unchanged data, existing fields, just
restructured into wide rows instead of a 5-column grid.

### ANTI-ROLL BARS
One row per axle (Front, Rear). Existing sub-values already computed and
usable as-is: `% of front/rear roll` = `rsAb/(rsSp+rsAb)*100`, `% of ARB
budget` = `rsAb/(rsAbF+rsAbR)*100`. Header-right: `tune.rollDeg` (roll
degrees). Keep section-level hint text (existing `hint=` prop), drop the
permanent inline amber "reads ~4-6x soft" block currently duplicated below
it in physical modes — that block is BeamNG-specific and out of scope here
since this pass is Forza-only, but note for the BeamNG follow-up that this
duplication (hint text + inline block saying nearly the same thing) should
be consolidated to one, not two.

### SPRINGS
One row per axle. Sub-values: `% of front/rear roll` (spring share, already
computed as `rsSpF/(rsSpF+rsAbF)*100` etc.), Hz (`tune.fHz`/`tune.rHz`).
Header-right: keep the **existing computed ratio** `${(tune.rHz/tune.fHz)
.toFixed(2)}` — do NOT substitute the raw `fe.rearHzMult` slider value.
Confirmed in code: `rearHzMult` is a distinct input only literally applied
when `rearHzMode==='multiplier'`; under Flat Ride/Mech/Independent modes the
actual rear:front Hz ratio differs from the raw slider. The wireframe's
"Rear Multiplier x#.##" label refers to this computed ratio badge, which
already exists and is already correct — just carry the label/behavior over
unchanged.

### DAMPERS
Four rows: Front Rebound, Rear Rebound, Front Bump, Rear Bump. New per-row
content requested, both confirmed as existing data being *relocated* into
this card, not new physics:
  - **Settle time**: `settleF`/`settleR` already computed per-axle in
    `computeTune` (front/rear both exist — note current output object uses
    `settle` for front and `settleR` for rear; confirm/rename for clarity
    when wiring into the new rows, e.g. `settleF`/`settleR` both present as
    of `computeTune`'s return around the settle-mode block).
  - **Under/overdamped warning**: the `⚠ OVERDAMPED` label + color-zone
    concept already exists (currently only in the RIDE input section's
    damping visual, threshold logic around the `zLabel`/`bz>100` checks).
    Reuse the same threshold logic here rather than inventing new bounds.
  - Header-right: `F/R Bias ##%` (existing `fe.dampingBias` input state) and
    `Bump Ratio ##% Zeta` (existing `bumpRatioVal`/`fe.bumpRatio` input
    state) — both already computed, just need surfacing as card-header
    context rather than being sidebar-only.
  - Per-row zeta: existing `zetaF`/`zetaR`/`bumpZetaF`/`bumpZetaR`.

### BRAKES
Stays its own section, positioned between DAMPERS and DIFFERENTIAL —
confirmed this already matches both (a) the app's current card order and
(b) real Forza tuning-menu order (Alignment → ARB → Springs → Damping →
Brake → Differential). No relocation needed despite the open question in
the wireframe; the current position is already correct.

**Remove BALANCE... no — remove PRESSURE.** Confirmed in code:
`brakePressure` is `const brakePressure=100` — a hardcoded, never-derived
constant with no downstream consumer anywhere in the file. It is dead
output and should be deleted from the card entirely.

**Keep BALANCE.** `brakeBias` (`recBrakeBias`) is real and feeds
`bBrakeEntry`, which is a live contributor to the Handling Balance model.
Do not remove.

### DIFFERENTIAL
Confirmed: `diff.layout` branches AWD vs FWD/RWD today with genuinely
different field sets — this must be preserved, the dense wireframe layout is
NOT universal as drawn:

  - **AWD**: full five-field layout as sketched — Front Accel, Front Decel,
    Rear Accel, Rear Decel, Center Split (existing fields: `diff.frontAccel`,
    `diff.frontDecel`, `diff.rearAccel`, `diff.rearDecel`, `diff.center`).
  - **FWD/RWD**: same dense row styling/treatment as AWD, but only two
    fields — Accel Lock, Decel Lock (existing fields: `diff.accel`,
    `diff.decel`). Do NOT show Center Split or a front/rear axle split for
    these layouts — there isn't one (single differential, not front+rear+
    center).

**Remove the per-axle bias strip** (`fmtBias`/`strip`/`biasStrip` in the
current code — the "ACCEL BIAS -OS 2.2 / DECEL BIAS" or "F.AXLE / R.AXLE"
row). Confirmed redundant: this same information already surfaces in the
footer's Handling Balance contributions breakdown (SPR/ARB/DIFF/BRK). Cut
it from this card entirely — not relocated, since it's already available
elsewhere.

**Keep the RECOMMENDED / CENTER SPLIT call-out blocks**, including their
existing "→ USE X%" / "→ USE {type}" apply buttons — these are functional
(they call `setDr`), not just static display, despite reading as static
boxes in the wireframe. Confirm this interactivity survives the restructure;
it's easy to accidentally flatten into non-interactive text when
re-templating a card.

## Explicitly out of scope for this pass

- BeamNG-mode output reordering (physical-subsystem grouping, ARB caveat
  consolidation) — separate, already-scoped follow-up from earlier
  discussion, not part of this restructure.
- Any change to footer diagnostic content (Handling Balance, Mech Balance,
  Response) — confirmed already correctly separated from the output cards;
  no changes needed there as part of this pass.
- Any change to underlying `computeTune`/`computeDiff`/`computeAlignment`
  physics or values — this is purely a display/layout restructure. No
  formula, constant, or calculation should change. If implementing this
  reveals a value used in the new layout doesn't exist where expected
  (e.g. a settle-time field name mismatch), fix the plumbing/naming, not the
  math.

## Verification checklist for implementation

- [ ] All rows fill available width (no more `maxWidth:1400`-capped narrow
      columns with visible dead margin on wide viewports — confirm on a
      wide monitor screenshot, not just default window size).
- [ ] FWD and RWD differential cards show 2 fields (Accel/Decel Lock), no
      Center Split, no axle-split fields — verify against a FWD and an RWD
      test config, not just AWD.
- [ ] `brakePressure` fully removed — grep confirms no remaining references.
- [ ] `biasStrip`/`fmtBias` removed from the Differential card; footer
      Handling Balance contributions still show the equivalent info
      unchanged.
- [ ] RECOMMENDED / CENTER SPLIT apply buttons (`setDr` calls) still work
      after restructure.
- [ ] Springs card header ratio still reads `rHz/fHz` (computed), not the
      raw `rearHzMult` slider value, under all four Hz modes (Flat Ride,
      Multiplier, Mech, Independent) — spot check Multiplier mode
      specifically, where the two could easily be confused as "the same
      number" during implementation.
- [ ] `tests.js`/`tests-beamng.js` still pass — this is display-only, so no
      physics assertion should change; if any does, that's a signal the
      restructure accidentally touched compute logic and needs to be
      reverted to display-only.
- [ ] Docs sync per CLAUDE.md: update `docs/CODE_MAP.md` if section
      structure/component names change meaningfully; no PHYSICS/FORMULAS
      changes expected since no math changed.
