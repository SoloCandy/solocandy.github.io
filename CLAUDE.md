# SUSP.OS — Project Guidance

## After major changes: review the README **and `docs/`**
Whenever you make a major change (new feature, removed/renamed UI control, changed
input ranges or limits, calibration constants, balance modes, etc.), review
`README.md` and verify it still matches the app. If anything is stale or missing,
update it as part of the same change — don't leave the docs out of sync.

Examples of what tends to drift:
- Input ranges / limits (e.g. frequency band, ARB clicks, brake %)
- Balance modes and their behaviour tables
- Calibration constants table
- Section names and where controls live
- Tier (BEG/INT/PRO) feature lists

The obligation covers `docs/` too, not just the README — most of the drift lives
there. Which doc to check, by what you touched:

| Changed | Update |
|---|---|
| localStorage keys, persisted shapes, backup format | `docs/PERSISTENCE.md` |
| `zone-*` ids, components, file structure, anything that *looks* dead but isn't | `docs/CODE_MAP.md` |
| Factory presets, `PRESET_DESC`, `BUILD_PRESET_MAP` | `docs/PRESETS.md` |
| Share-code fields or ids | `docs/CODEC.md` (ids are permanent — retire, never reuse) |
| Slider range / mechanism / tier gating | `docs/SLIDERS.md` |
| Hz / spring / damper solve math | `docs/PHYSICS.md` |
| Balance contributor formulas or signs | `docs/FORMULAS.md` |
| Camber / toe / caster | `docs/ALIGNMENT.md` |
| A bug fixed, or a limitation found | `docs/KNOWN_ISSUES.md` |

Two habits worth keeping: record *why* something non-obvious stays (CODE_MAP's
"intentionally-retained legacy" section exists so the next audit doesn't delete
load-bearing code), and don't put line numbers in docs — they go stale within a
commit or two. Reference identifiers instead.
