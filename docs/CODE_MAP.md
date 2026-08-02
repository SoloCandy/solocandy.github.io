# SUSP.OS — Code Map

How `index.html` is organised, and — just as important — which code looks
dead but must not be removed.

The other docs in this folder describe the *domain* (physics, sliders, codec,
alignment). This one describes the *file*.

> No line numbers anywhere in this doc, deliberately — they go stale within a
> commit or two. Search by identifier instead.

---

## The file is one big `text/plain` script

`index.html` is not a normal script tag. The whole application lives in:

```html
<script id="app-source" type="text/plain"> … </script>
```

A small bootstrap at the end of the file reads that element's `textContent`,
runs it through `Babel.transform` (presets `env` + `react`, plus the
optional-chaining / nullish-coalescing / logical-assignment plugins), and
evaluates the result with indirect `eval` — indirect specifically so errors
stay catchable on iOS WebKit.

This is why there is no build step, and it shapes how failures appear:

| Failure | What the user sees |
|---|---|
| Babel can't parse the source (JSX/syntax error) | `#pre-load` shows "Babel compilation failed" + the message |
| Source parses but throws while evaluating | `#pre-load` shows "Runtime error" + the message |
| React renders but a component throws | `ErrorBoundary` renders "SUSP.OS — Failed to load" |
| All good | `#pre-load` is hidden and empty |

Two consequences worth knowing when editing:

- A syntax error blanks the whole page. `#pre-load` is the first thing to
  check when the app won't load.
- You can compile-check the app from the browser console without rendering it,
  by transforming `#app-source` yourself inside a `try/catch`. That is the
  cheapest gate available, and given there is no linter or CI it is worth
  using after any JSX edit.

---

## Region order

The source runs top to bottom in this order:

1. **Calibration constants and limits** — `DAMPING_CALIBRATION`,
   `TIRE_LOAD_SENS`, `MECH_BAL_GAIN`, `WIDTH_GRIP_EXP`, `TIRE_MECH_SCALE`,
   `MECH_BALANCE_TARGET`, `ARB_RS_SCALE`, `HZ_MIN`/`HZ_MAX`, `GAME_LIMITS`,
   `BRAKE_BIAS_SCALE`, `DIFF_BIAS_SCALE`. Changing any of these retunes the
   whole app; the README carries the calibration table.
2. **Pure physics** — no React, no state, safe to lift out (see below).
3. **Defaults and presets** — `DEF_CH`, `DEF_FE`, `DEF_DR`, `DEF_AL`,
   `PRESET_SAVES`, `BUILD_PRESET_MAP`.
4. **Persistence primitives** — `mergeDefaults`, `usePersist`.
5. **Shared components** — see the table below.
6. **Codec** — `CODEC_FIELDS`, `encodeTune`, `decodeTune`, `sanitizeTune`.
7. **Tutorial content** — the `TUTORIALS` object and `TutorialPanel`.
8. **`App()`** — all remaining state, the derived `useMemo` chain, and the
   entire sidebar + output JSX.
9. **Bootstrap** — the Babel/eval block described above.

### Pure physics entry points

These are pure functions of their arguments, in dependency order:

```
feelToPhysics(ch, fe)                  → resolves feel settings into physics
                                         (front/rear Hz, ζ per axle, ARB mode…)
computeTune(ch, physics, gameMode)     → springs, dampers, ARBs, balance
computeDiff(ch, fe, dr)                → differential locks (independent)
computeAlignment(ch, tune, layout, …)  → camber/toe/caster, from the tune
```

Supporting: `rsToHz`/`hzToRs`, `flatRideRearHz`, `flatRideSharedHz`,
`solveSpring`, `solveDampRaw`, `settleZetas`, `cornerMasses`,
`rollCenterHeight`, `parseTyre`, `mechBalanceLLT`, `balanceFromRsBal`,
`naturalMechBalanceOf`, `resolveArbBalTarget`. `computeCheck` backs the TUNE
CHECK reverse calculator.

In `App()` the chain is `feelToPhysics` → `computeTune` → everything else,
each in its own `useMemo`.

---

## Components

| Component | Rendered in |
|---|---|
| `Hint` | everywhere — the ⓘ affordance |
| `Field` | numeric inputs across all sections |
| `FeelSlider` | BEG feel sliders and most INT/PRO sliders |
| `Toggle` | mode switches |
| `Sec` | the nine collapsible sidebar sections (`div.stog` header) |
| `Readout`, `Stat`, `Card` | the output panel |
| `BiasSeg` | balance-bar segments |
| `SpringDial`, `ArbDial`, `DampingDial` | the pinned VISUALS card |
| `HandlingVerdict` | expanded handling-balance panel only |
| `EntryCard` | one garage entry inside the GARAGE drawer |
| `CheckerModal` | TUNE CHECK (DECODE / MEASURE) |
| `GlossaryModal` | glossary lookup |
| the data modal | SHARE / LOAD CODE / BACKUP / RESTORE (inline in `App`, not a component) |
| `TutorialPanel` | the guided tours |
| `OverwriteBtn` | *(no current call site — `useTwoTap`, the hook behind it, is what the garage reuses)* |
| `ErrorBoundary` | wraps the app |

The GARAGE drawer itself is inline JSX in `App` (it needs a dozen handlers off
`App` state); only the per-entry card is factored out. `Sec`'s count above is
hardcoded prose — verify it rather than trusting it after any section change.

Note `HandlingVerdict` and the RESPONSE factor breakdown render **only** when
the handling-balance panel is expanded, the dials render **only** inside
VISUALS (hidden entirely in BEG), and the GARAGE drawer renders behind a toolbar
toggle. None of them are reachable from a cold page load, which matters when
testing.

---

## Sidebar zones and tier gating

Every spotlightable region carries an `id="zone-…"`, used by the tutorial
system for focus/dimming. There are 18 in the source; which exist in the DOM
depends on the tier.

- **All tiers**: `zone-garage` — the right-side GARAGE drawer. It is *not* part
  of the sidebar, so it sits outside the per-tier lists below and is the only
  zone present at every tier regardless of panel.
- **BEG** renders its own flat panel: `zone-layout-build`, `zone-build-type`,
  `zone-weight`, `zone-ride-stiffness`, `zone-balance`, `zone-character`, plus
  `zone-output` and `zone-balance-bar`. No `Sec` sections at all, and no VISUALS.
- **INT** switches to the sectioned sidebar: `zone-chassis`, `zone-build`,
  `zone-drivetrain`, `zone-arb`, `zone-feel`, `zone-damping`,
  `zone-visuals`, plus output and balance bar.
- **PRO** adds `zone-balance-target` and `zone-alignment`, and unlocks extra
  controls inside the shared sections (CHASSIS geometry, ARB MECH/CO-SOLVE/MAN,
  Hz MECH mode, Alignment Mode).

`zone-presets` no longer exists. It was duplicated across the BEG panel and the
INT/PRO BUILD section (safe only because the two were mutually exclusive on
`uiMode`); both copies went when the factory presets moved into the GARAGE panel.

Sections are collapsed on load — `open` is plain `useState`, not persisted.

---

## localStorage

All keys are namespaced `suspos_`. Versions are per-key; see
[PERSISTENCE.md](PERSISTENCE.md) for when to bump one (removing a field never
requires it — the stale key is simply ignored).

`suspos_ch_v8`, `suspos_fe_v8`, `suspos_dr_v8`, `suspos_al_v2`,
`suspos_units_v1`, `suspos_uimode_v1`, `suspos_zoom_v1` (read-only now),
`suspos_tutorial_seen_v1`, `suspos_baltut_seen_v1`, `suspos_onboard_v1`,
`suspos_garage_v2`, `suspos_garage_ui_v1`.

Special ones — a three-deep migration chain plus its two sentinels:

- **`suspos_saves_v9`** — read-only legacy preset slots. Never written.
- **`suspos_builds_v1`** and **`suspos_garage_v1`** — read-only legacy save
  lists. No UI, no React binding; the unified migration's two `getItem` calls
  are their only readers.
- **`suspos_builds_migrated_v1`**, **`suspos_garage_unified_v2`** — sentinels,
  not data. Presence means that link of the chain already ran.

`usePersist` merges a stored object over the defaults (`{...initial,
...parsed}`), so a partial object in storage is valid and missing keys fall
back to their default.

---

## Intentionally-retained legacy — do not remove

Everything in this section **looks** dead to a search-based audit and is not.
Each entry is load-bearing for users with existing saved state or shared
codes. If you are cleaning up dead code, this is the list to check first.

**`arbBalMode: 'man'`** — a retired enum value. It stays at its original index
in `ARB_BAL_MODE_DEC` so old share codes still decode to the right string;
`sanitizeTune` then rewrites it to `'manual'`. There is a second, separate
migration for persisted state in `App()`. Removing either breaks old codes and
old saves respectively.

**`arbBalMode: 'manual'`** — deliberately invisible. It behaves exactly like
`'weight'` but is not one of the Balance Mode buttons, so nothing lights up
while Stiffness Mode is MAN. TUNE CHECK's import is its live producer. A
value that no UI control sets is the intended design here, not an oversight.

**`ARB_MODE_DEC` index 3** — decodes a retired `'balance'` value to `'auto'`.
Index 4 is `'man'`, relocated from `ARB_BAL_MODE`. Both positions are frozen.

**`al.alignManual`** — `DEF_AL` still defines it and `alignMode` still falls
back to it (`al.mode ?? (al.alignManual ? 'manual' : 'build')`) for state
saved before `al.mode` existed. The *other* former use of it — the ALIGNMENT
card's hint prefix — was a genuine bug and has been fixed to read `alignMode`;
that does not make the fallback removable.

**`al.camberF` / `toeF` / `toeR` / `caster` / `camberR`** — these were dead
state once, and are live now (PRO Alignment Mode MANUAL). See
[ALIGNMENT.md](ALIGNMENT.md).

**`arbBalTargetMode` / `arbBalDelta`** — fully live; they drive GRIP balance
mode. Easy to mistake for orphans because the names suggest a superseded
target system.

**The `arbBalModeEarly === 'man'` branches in `feelToPhysics`** — reachable
only on the first render after loading pre-migration state, before the
migration effect fires. Not reproducible in a browser test, and exactly the
path that would break a real user's saved tune.

**`CODEC_VERSION`** — do not bump casually. `decodeTune` throws on any
mismatch, which invalidates every share code in existence.

**Codec ids** — permanent. If a field is ever removed, retire its id in
[CODEC.md](CODEC.md) and in the "Retired ids" comment rather than reusing it.
No id has been retired so far.

**The `rsToHz` 0–100 → Hz conversion** — migrates saves from before Ride
Stiffness stored Hz directly. Also called by `autoTagsOf` before `hzCtx`: without
it a legacy `rideStiffness: 50` classifies as RACE instead of ROAD. That failure
only shows on old entries, so it survives testing on fresh data.

**`suspos_garage_v1` and `suspos_builds_v1`** — the pre-unification save lists.
They have no UI and no React binding any more; the unified migration effect's two
`getItem` calls are their **only** readers, which is exactly what makes them look
like dead keys. Deleting them, or that effect, silently loses every saved chassis
and build for anyone who hasn't opened the app since the unification. Same for
the two sentinels — clearing one causes its migration to run a second time.

**`suspos_saves_v9`** — first link of the same chain
(`suspos_saves_v9` → `suspos_builds_v1` → `suspos_garage_v2`). Removing the middle
link breaks the tail for users who skipped a version.

**`TutorialPanel`'s `right` positioning fallback** — still unreachable (every
`setPos` sets `left`). The GARAGE drawer is the first right-side, full-height
tutorial target, and it does *not* reach that branch: a full-height element leaves
no room above or below, so `measure()` falls through to `setPos(null)` and centres
the card, which then draws over the drawer (card z700, drawer z200). Verified, not
assumed. The fallback stays as a cheap defensive branch.

---

## Testing reality

There is **no CI, no linter, no type checker, no build step, and no git
hooks.** `tests.js` is a hand-maintained duplicate of the physics functions
and does not read `index.html` at all — it passes whether or not the app
works. See the Test coverage section of [PHYSICS.md](PHYSICS.md).

So the only real verification is the browser. A reasonable routine after a
non-trivial edit:

1. Compile-check `#app-source` through Babel (catches the page-blanking case).
2. Load the app; confirm `#pre-load` is empty and the console is clean.
3. Exercise the tiers the change touches — BEG, INT and PRO gate different
   code, and VISUALS, the expanded balance panel, and the modals are not
   reachable from a cold load.
4. Round-trip a share code (SHARE → LOAD CODE) if anything near the codec,
   defaults, or `sanitizeTune` moved.
5. `node tests.js` if any mirrored physics function changed — and update the
   mirror by hand, since nothing will tell you it drifted.
