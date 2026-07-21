# SUSP.OS — Share Codec Field Reference

The SHARE / LOAD CODE feature encodes tune state as a compact, sparse
`id:value` list, Base64-wrapped. Every field gets a permanent numeric `id`
in `CODEC_FIELDS` (~index.html:1811-1867). This table exists so a new field
never accidentally reuses an old id and breaks existing share codes.

> **Rule: ids are permanent.** Once assigned, an id must never be reused for
> a different field, even if the original field is removed. If a field is
> deleted, move its id to the "Retired — never reuse" list below (and in
> the code comment) instead of deleting the row outright.

Fields not present in a code default to `DEF_GROUPS[group][key]` (or `def`
for tyre sub-fields) — this is what makes old codes forward-compatible with
new fields added later, and new codes backward-compatible with fields a
future version might not carry.

## Field table

| ID | Group | Key | Encoding |
|---|---|---|---|
| 1 | ch | weight | raw number |
| 2 | ch | frontBias | raw number |
| 3 | ch | wheelbase | raw number |
| 4 | ch | cgHeight | raw number |
| 5 | ch | trackF | raw number |
| 6 | ch | trackR | raw number |
| 7 | fe | rideStiffness | raw number |
| 8 | fe | arbBias | raw number |
| 9 | fe | targetSpeed | raw number |
| 10 | fe | gameMode | enum (`GAME_MODE_ENC/DEC`) |
| 11 | fe | dampingMode | enum (`DAMPING_MODE_ENC/DEC`) |
| 12 | fe | reboundZeta | raw number |
| 13 | fe | bumpRatio | raw number |
| 14 | fe | bumpZeta | raw number |
| 15 | fe | arbMode | enum (`ARB_MODE_ENC/DEC`) |
| 16 | fe | arbTargetRollMan | raw number |
| 17 | fe | arbShareMan | raw number |
| 18 | ch | layout | enum (`LAYOUT_ENC/DEC`) — moved from `dr` group; see note below |
| 19 | dr | buildType | enum (`BUILD_ENC/DEC`) |
| 20 | dr | diffManual | bool |
| 21 | dr | diffBiasExit | raw number |
| 22 | dr | diffAccel | raw number |
| 23 | dr | diffDecel | raw number |
| 24 | dr | diffFrontAccel | raw number |
| 25 | dr | diffFrontDecel | raw number |
| 26 | dr | diffRearAccel | raw number |
| 27 | dr | diffRearDecel | raw number |
| 28 | dr | diffCenter | raw number |
| 29 | dr | diffBiasEntry | raw number |
| 30 | fe | rearHzMode | enum (`REAR_HZ_MODE_ENC/DEC`) |
| 31 | fe | rearHzMan | raw number |
| 32 | fe | rearHzMult | raw number |
| 33 | fe | dampingBias | raw number |
| 34 | tyre F | width | tyre sub-field, default 265 |
| 35 | tyre R | width | tyre sub-field, default 265 |
| 36 | tyre F | aspectRatio | tyre sub-field, default 35 |
| 37 | tyre F | rimDiameter | tyre sub-field, default 18 |
| 38 | tyre R | aspectRatio | tyre sub-field, default 35 |
| 39 | tyre R | rimDiameter | tyre sub-field, default 18 |
| 40 | fe | arbBalTarget | raw number — semantics changed to "delta from natural mech balance" (see note) |
| 41 | fe | arbBalMode | enum (`ARB_BAL_MODE_ENC/DEC`) |
| 42 | dr | diffFrontExitBias | raw number |
| 43 | fe | springShare | raw number |
| 44 | fe | rideRef | enum (`RIDE_REF_ENC/DEC`) |
| 45 | dr | diffComplement | bool |
| 46 | fe | arbManF | raw number |
| 47 | fe | arbManR | raw number |
| 48 | fe | settleBias | raw number |
| 49 | fe | settleMode | bool |
| 50 | fe | settleTarget | raw number |
| 51 | fe | dampCharMode | enum (`{zeta:0,settle:1}`) |
| 52 | dr | diffType | enum (`DIFF_TYPE_ENC/DEC`) |
| 53 | fe | arbBalTargetMode | enum (`{manual:0,grip:1}`) |
| 54 | fe | arbBalDelta | raw number |
| 55 | fe | springShareAuto | bool |

**Next available id: 56.**

## Retired — never reuse

None yet. (No field has been deleted since the codec's v1 sparse-table
redesign; ids that predate it were never individually numbered.)

## Notes on semantic changes (id kept, meaning changed)

Changing what a raw number *means* without changing its `id`/`group`/`key`
is technically safe for the codec (it just moves bytes), but it silently
reinterprets old codes under new rules. Two examples so far:

- **id 18 (`layout`)** — moved from `group:'dr'` to `group:'ch'` so it
  saves/loads with Garage instead of My Builds. Old codes still decode
  correctly (the wire value is unchanged, only which in-memory object it's
  written into changed).
- **id 40 (`arbBalTarget`)** — changed from an absolute mech-balance value
  (0.20-0.90) to a delta from `naturalMechBalanceOf(ch)`. Old codes/saved
  builds with an explicit (non-default) target will be reinterpreted under
  the new delta semantics and will likely need re-tuning.
- **id 41 (`arbBalMode`) `'man'`** — MAN moved from Balance Mode to Stiffness
  Mode (id 15, `arbMode`), since it bypasses the budget/split system
  entirely rather than choosing a split within it. `'man'` stays in
  `ARB_BAL_MODE_DEC` at its original index purely so old codes still decode
  the string correctly, but `sanitizeTune` immediately rewrites it: any
  decoded `arbBalMode:'man'` becomes `arbBalMode:'weight'` + `arbMode:'man'`.
  A matching one-time migration effect in `App()` does the same for plain
  persisted state (pre-move saves loaded without going through a share
  code). `arbManF`/`arbManR` (ids 46/47) are untouched by the move.
- **id 41 (`arbBalMode`) `'chassis'`** — new PRO-only mode (index 5), added
  alongside the MAN migration. Same split formula as WEIGHT, but anchored to
  `naturalMechBalanceOf(ch)` (track-width geometry, or the MEASURE NAT BAL
  reading when set) instead of raw `ch.frontBias` — see
  [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for why WEIGHT itself was deliberately
  left on the simpler raw-weight formula rather than switched over.

When making a change like this, note it here so future debugging of "why
did my old share code load weird" has a paper trail.
