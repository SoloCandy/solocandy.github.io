# SUSP.OS — localStorage Persistence Keys

All persisted state uses the `usePersist(key, initial)` hook
(~index.html:903-915), which merges stored JSON over the default object
(`{...initial, ...parsed}`) — so adding a new field to a default object is
automatically picked up for existing users without a migration step. Only
bump the version suffix when a field's **meaning** changes in a way that
old stored values would misrepresent (see [CODEC.md](CODEC.md) for recent
examples of that).

| Key | Holds | Default |
|---|---|---|
| `suspos_ch_v8` | Chassis state (`ch`) — weight, frontBias, tyres, wheelbase, track widths, CG height, layout, measured nat-bal | `DEF_CH` |
| `suspos_fe_v8` | Feel/tune state (`fe`) — ride stiffness, ARB modes, damping, balance targets | `DEF_FE` |
| `suspos_dr_v8` | Drivetrain state (`dr`) — build type, diff type, diff lock/bias fields | `DEF_DR` |
| `suspos_al_v2` | Alignment state (`al`) — manual override flag, camber/toe/caster | `DEF_AL` |
| `suspos_units_v1` | Metric vs imperial display toggle | `false` (imperial) |
| `suspos_saves_v9` | Legacy preset save slots — **read-only**, kept only as the one-time migration source for My Builds | `PRESET_SAVES` |
| `suspos_uimode_v1` | Current complexity tier (`beginner`/`intermediate`/`pro`) | `'beginner'` |
| `suspos_zoom_v1` | Desktop UI zoom level | `1.1` |
| `suspos_tutorial_seen_v1` | Which tier guides have been dismissed | `{beginner:false, intermediate:false, pro:false}` |
| `suspos_baltut_seen_v1` | Whether the Handling Balance bar's own guide has been seen | `false` |
| `suspos_onboard_v1` | Whether the first-run onboarding has been seen | `true` |
| `suspos_garage_v1` | Saved Garage entries (chassis snapshots: `{id, name, ch, savedAt}`) | `[]` |
| `suspos_builds_v1` | Saved My Builds entries (tune snapshots: `{id, name, fe, dr, savedAt}`) | `[]` |

## When to bump a version suffix

Bump (e.g. `_v8` → `_v9`) when:
- A field's stored value changes meaning (absolute → delta, different unit,
  different enum set) such that old stored values would now be
  misinterpreted, **and** you want a clean break rather than relying on
  `mergeDefaults` to paper over it.
- You're restructuring the shape of the object enough that a partial merge
  with old data would leave it in an inconsistent state.

Don't bump for:
- Adding a new field with a sensible default — `mergeDefaults` already
  handles this (existing users get the new default automatically).
- Removing a field — the extra key just sits unused in storage, harmless.

## Garage vs My Builds — what travels with what

- **Garage** (`ch`) — the physical car: weight, front bias, tyres,
  wheelbase, track widths, CG height, layout. Saving/loading a Garage entry
  is a full generic spread (`{...ch}` / `{...DEF_CH,...s.ch}`), so any new
  `ch` field automatically starts traveling with Garage saves with no code
  change required.
- **My Builds** (`fe` + `dr`) — the tune: feel settings and diff tune.
  Same generic-spread behavior applies for any new `fe`/`dr` field.

This split was deliberately chosen (see the `layout` migration in
[CODEC.md](CODEC.md)) so a field only needs to move between `ch` and
`dr`/`fe` in the state model — Garage/My Builds save/load code itself never
needs to change.
