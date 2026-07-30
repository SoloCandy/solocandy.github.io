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
| `CheckerModal` | TUNE CHECK (DECODE / MEASURE) |
| `GlossaryModal` | glossary lookup |
| `TutorialPanel` | the guided tours |
| `OverwriteBtn` | MY BUILDS slots |
| `ErrorBoundary` | wraps the app |

Note `HandlingVerdict` and the RESPONSE factor breakdown render **only** when
the handling-balance panel is expanded, and the dials render **only** inside
VISUALS (hidden entirely in BEG). None of them are reachable from a cold page
load, which matters when testing.

---

## Sidebar zones and tier gating

Every spotlightable region carries an `id="zone-…"`, used by the tutorial
system for focus/dimming. There are 19 in the source; which exist in the DOM
depends on the tier.

- **BEG** renders its own flat panel: `zone-layout-build`, `zone-build-type`,
  `zone-weight`, `zone-presets`, `zone-ride-stiffness`, `zone-balance`,
  `zone-character`, plus `zone-output` and `zone-balance-bar`. No `Sec`
  sections at all, and no VISUALS.
- **INT** switches to the sectioned sidebar: `zone-chassis`, `zone-build`,
  `zone-drivetrain`, `zone-arb`, `zone-feel`, `zone-damping`, `zone-garage`,
  `zone-visuals`, plus output and balance bar.
- **PRO** adds `zone-balance-target` and `zone-alignment`, and unlocks extra
  controls inside the shared sections (CHASSIS geometry, ARB MECH/CO-SOLVE/MAN,
  Hz MECH mode, Alignment Mode).

Sections are collapsed on load — `open` is plain `useState`, not persisted.

---

## localStorage

All keys are namespaced `suspos_`. Versions are per-key; see
[PERSISTENCE.md](PERSISTENCE.md) for when to bump one (removing a field never
requires it — the stale key is simply ignored).

`suspos_ch_v8`, `suspos_fe_v8`, `suspos_dr_v8`, `suspos_al_v2`,
`suspos_units_v1`, `suspos_uimode_v1`, `suspos_zoom_v1`,
`suspos_tutorial_seen_v1`, `suspos_baltut_seen_v1`, `suspos_onboard_v1`,
`suspos_garage_v1`, `suspos_builds_v1`.

Two special ones:

- **`suspos_saves_v9`** — read-only. Kept solely as the source for the
  one-time MY BUILDS migration. Never written.
- **`suspos_builds_migrated_v1`** — a sentinel, not data. Its presence means
  that migration already ran.

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
Stiffness stored Hz directly.

**`TutorialPanel`'s `right` positioning fallback** — currently unreachable
(every `setPos` sets `left`), but it is a cheap defensive branch in a system
that has been reworked repeatedly.

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
