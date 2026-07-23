# SUSP.OS — Factory Presets Reference

The six factory presets in `PRESET_SAVES`, loaded via
the FACTORY cards in the BUILDS drawer. Each preset sets `fe` and `dr`
fields on top of the defaults (`{...DEF_FE, ...}` / `{...DEF_DR, ...}`) —
any field not listed below stays at its `DEF_FE`/`DEF_DR` default.

Loading a preset does **not** touch `ch` (chassis) or `layout` — both are
treated as sticky, car-specific state that a preset shouldn't override (see
`loadPreset`, and the `layout` migration in
[CODEC.md](CODEC.md) for why layout in particular is excluded).

**Beginner mode** additionally forces `arbBalMode:'neutral'` and
`arbMode:'auto'` on preset load (Beginner doesn't expose these mode
toggles, and its Balance slider's own mechanism assumes NEUTRAL ARB mode —
see the Balance row in [SLIDERS.md](SLIDERS.md)), plus `dampCharMode:'zeta'`
and zeroed `settleBias`/`dampingBias` since Beginner's Character slider
only understands the simple rebound-ζ/bump-ratio model.

| # | Name | Build Type | Diff Type | Ride Stiffness | Rear Hz Mult | Damping Char | Notes |
|---|---|---|---|---|---|---|---|
| 1 | STREET | street | sport | 2.20 Hz | 1.15× | SETTLE 0.55s, bias 0 | Bump ratio 52, ARB AUTO. diffBiasExit −10 (GRIP-leaning), diffBiasEntry +10 (STABLE-leaning) |
| 2 | TRACK | track | race | 2.50 Hz | 1.05× | SETTLE 0.40s, bias −5 | Bump ratio 58, ARB ROLL @ 1.5°. diffBiasExit +5, diffBiasEntry 0 |
| 3 | RALLY | rally | rally | 1.55 Hz | 1.05× | CHARACTER ζ=58, bias −5 | Bump ratio 38, ARB SHARE @ 8%. diffBiasExit −5, diffBiasEntry −15 |
| 4 | DRIFT | drift | drift | 1.80 Hz | 1.30× | CHARACTER ζ=60, bias +18 | Bump ratio 40. diffBiasExit +22, diffBiasEntry −18, diffRearAccel 65, diffRearDecel 15 |
| 5 | MOTORSPT | track | race | 3.20 Hz | 0.92× | SETTLE 0.25s, bias −10 | Bump ratio 64, ARB ROLL @ 0.8°. diffBiasExit +10, diffBiasEntry −5 |
| 6 | X COUNTRY | offroad | offroad | 0.90 Hz | 1.00× | SETTLE 1.00s, bias −5 | Bump ratio 38, ARB SHARE @ 5% |

## Reading the columns

- **Ride Stiffness** — `fe.rideStiffness`, the front spring frequency (Hz)
  before layout/build-specific derivation.
- **Rear Hz Mult** — `fe.rearHzMult` under `rearHzMode:'multiplier'`; ratio
  of rear to front spring frequency.
- **Damping Char** — either `SETTLE` mode (`dampCharMode:'settle'`,
  `settleTarget` in seconds, `settleBias` skew) or `CHARACTER` mode
  (`dampCharMode:'zeta'`, explicit `reboundZeta`, optional `dampingBias`).
- **diffBiasExit / diffBiasEntry** — see [SLIDERS.md](SLIDERS.md)'s EXIT/
  ENTRY rows for what these values mean directionally (positive =
  oversteer-leaning per the convention documented there).

## Build-type → recommended presets (Beginner mode)

Beginner mode's "★ FOR YOUR BUILD" recommendation
(`BUILD_PRESET_MAP`) maps build type to preset numbers:

| Build Type | Recommended preset(s) |
|---|---|
| street | 1 (STREET) |
| track | 2 (TRACK), 5 (MOTORSPT) |
| drift | 4 (DRIFT) |
| rally | 3 (RALLY) |
| offroad | 6 (X COUNTRY) |
| drag | 2 (TRACK) |

## Adding a new preset

- Add a new numbered entry to `PRESET_SAVES`, spreading `DEF_FE`/`DEF_DR`
  and overriding only what's distinctive about the preset.
- Update `PRESET_DESC` (two nearby copies — Beginner panel and BUILD &
  BALANCE's presets drawer) with a
  `tag`/`sub` description pair.
- Consider adding it to `BUILD_PRESET_MAP` if it should be the recommended
  starting point for a build type.
- Update this file.
