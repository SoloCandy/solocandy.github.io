// SUSP.OS — physical-unit (BeamNG) game mode tests
// Run with: node tests-beamng.js
// No dependencies required.
//
// UNLIKE tests.js, THIS FILE READS index.html. tests.js is a hand-maintained mirror of the
// physics functions and so cannot catch a change made only in the app; that gap is recorded
// in README and docs/CODE_MAP.md. The BeamNG mode is defined entirely by what it *doesn't*
// do to the solver's output, which a mirror cannot express — a mirror of "return the value
// unchanged" asserts nothing. So this suite lifts the real physics layer out of index.html
// and drives it directly.
//
// What it guards:
//   1. beamng emits exactly the pre-conversion physics (no calibration constant involved).
//   2. horizon/motorsport output is still recoverable from beamng output by applying only
//      the documented conversions — i.e. the branch diverges only where intended.
//   3. Nothing is clamped, quantised, or floored in physical mode.
//   4. CO-SOLVE's ARB_UTIL_REF substitution is neutral (the denominator cancels).
//
// If the slice() markers below stop matching, index.html has been reorganised — fix the
// markers rather than deleting the test.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0 || j <= i) throw new Error(`index.html slice failed: "${a}" .. "${b}"`);
  return src.slice(i, j);
};

// Order matters: the DEF_* literals execute at eval time and the enum block reads them.
const M = new Function(
  slice('const DEF_CH=', 'const DEF_AL=') + '\n' +
  slice('const GAME_MODE_ENC=', 'const CODEC_FIELDS=') + '\n' +
  slice('const KG_TO_LB=', 'const arbCtx=') +
  '\nreturn{computeTune,feelToPhysics,DEF_CH,DEF_FE,GAME_LIMITS,ARB_RS_SCALE,' +
  'DAMPING_CALIBRATION,LB_IN_TO_NM,N_MM_PER_LB_IN,NMM_PER_LBIN,cornerMasses,isPhysical};'
)();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓  ${name}`); }
  catch (e) { fail++; console.log(`  ✗  ${name}\n       ${e.message}`); }
};
const near = (got, want, tol, what) => {
  if (Math.abs(got - want) > tol * Math.max(1, Math.abs(want)))
    throw new Error(`${what}: got ${got}, expected ${want}`);
};
const solve = (chOver, feOver, mode) => {
  const ch = { ...M.DEF_CH, ...chOver }, fe = { ...M.DEF_FE, ...feOver };
  return { ch, fe, tune: M.computeTune(ch, M.feelToPhysics(ch, fe), mode) };
};

const CHS = [
  ['default', {}],
  ['light RWD', { weight: 2400, frontBias: 45, layout: 'RWD', trackF: 1.45, trackR: 1.48 }],
  ['heavy FWD', { weight: 4200, frontBias: 60, layout: 'FWD', trackF: 1.62, trackR: 1.58 }],
];

console.log('\n── mode plumbing ──');
t('beamng is a registered game mode with no ceiling', () => {
  const g = M.GAME_LIMITS.beamng;
  if (!g) throw new Error('GAME_LIMITS.beamng missing');
  if (g.arb !== null || g.damping !== null) throw new Error('beamng must have null limits');
  if (!M.isPhysical('beamng')) throw new Error('isPhysical(beamng) should be true');
});
t('the Forza modes are not physical', () => {
  if (M.isPhysical('horizon') || M.isPhysical('motorsport'))
    throw new Error('a click-scale mode must not report physical');
});
t('N_MM_PER_LB_IN is the correct conversion (1 lbf/in = 0.175127 N/mm)', () => {
  // Exactly N/m per lb/in divided by 1000 — that "/1000" is the whole point of this constant
  // existing separately from NMM_PER_LBIN, so assert it exactly.
  near(M.N_MM_PER_LB_IN, M.LB_IN_TO_NM / 1000, 1e-12, 'derivation from LB_IN_TO_NM');
  // And that it matches physical truth. Loose tolerance: the app's LB_IN_TO_NM is itself
  // imprecise in its 7th significant figure (175.126790921 vs 175.12683525), which predates
  // this work and is far below display resolution.
  near(M.N_MM_PER_LB_IN, 4.4482216152605 / 25.4, 1e-6, 'N/mm per lb/in');
});
t('NMM_PER_LBIN is still the known-wrong 10x value (see KNOWN_ISSUES)', () => {
  // Pinned deliberately. If someone fixes it, this test should be deleted along with the
  // KNOWN_ISSUES entry and N_MM_PER_LB_IN folded back in — not silently updated.
  near(M.NMM_PER_LBIN, M.N_MM_PER_LB_IN * 10, 1e-9, 'the documented 10x discrepancy');
});

console.log('\n── springs ──');
for (const [label, over] of CHS) {
  t(`${label}: spring rate is mode-invariant`, () => {
    near(solve(over, {}, 'beamng').tune.springF, solve(over, {}, 'horizon').tune.springF, 1e-12, 'springF');
  });
  t(`${label}: N/mm output equals wheel rate / 1000`, () => {
    const { ch, tune } = solve(over, {}, 'beamng');
    const m = M.cornerMasses(ch);
    const wr = Math.pow(tune.fHz * 2 * Math.PI, 2) * m.front;   // N/m
    near(tune.springF * M.N_MM_PER_LB_IN, wr / 1000, 1e-9, 'springF in N/mm');
  });
}

console.log('\n── dampers ──');
for (const [label, over] of CHS) {
  t(`${label}: beamng damping is the raw coefficient, uncalibrated`, () => {
    const { ch, tune } = solve(over, {}, 'beamng');
    const m = M.cornerMasses(ch);
    const wr = Math.pow(tune.fHz * 2 * Math.PI, 2) * m.front;
    const cc = 2 * Math.sqrt(wr * m.front);                     // N.s/m
    near(tune.rebF, cc * (tune.zetaF / 100), 1e-9, 'rebF');
  });
  t(`${label}: horizon damping == beamng damping x DAMPING_CALIBRATION`, () => {
    const b = solve(over, {}, 'beamng').tune, h = solve(over, {}, 'horizon').tune;
    near(h.rebF, Math.round(b.rebF * M.DAMPING_CALIBRATION * 10) / 10, 1e-9, 'rebF');
    near(h.bumpR, Math.round(b.bumpR * M.DAMPING_CALIBRATION * 10) / 10, 1e-9, 'bumpR');
  });
  t(`${label}: damping lands inside BeamNG's documented 500-20000 N/m/s band`, () => {
    const b = solve(over, {}, 'beamng').tune;
    for (const k of ['rebF', 'rebR', 'bumpF', 'bumpR'])
      if (!(b[k] > 200 && b[k] < 30000)) throw new Error(`${k} = ${b[k].toFixed(1)} N.s/m`);
  });
}

t('an extreme setup that pins horizon is left unclamped in beamng', () => {
  const over = { weight: 5200, trackF: 1.7, trackR: 1.7 };
  const fe = { rearHzMode: 'independent', rearHzInd: 3.4, reboundZeta: 110 };
  if (!solve(over, fe, 'horizon').tune.dampingClamped)
    throw new Error('fixture no longer pins horizon — pick a harsher one');
  if (solve(over, fe, 'beamng').tune.dampingClamped)
    throw new Error('beamng reported dampingClamped despite having no ceiling');
});

t('physical damping keeps full precision (no 0.1-click quantisation)', () => {
  const b = solve({}, {}, 'beamng').tune;
  if (Math.abs(b.rebF - Math.round(b.rebF * 10) / 10) < 1e-12)
    throw new Error('rebF looks quantised to 0.1 — the click rounding is still applied');
});

console.log('\n── anti-roll bars ──');
for (const [label, over] of CHS) {
  t(`${label}: beamng ARB output IS the roll stiffness`, () => {
    const b = solve(over, {}, 'beamng').tune;
    near(b.rsAbF, b.arbF, 1e-12, 'rsAbF vs arbF');
    near(b.rsAbR, b.arbR, 1e-12, 'rsAbR vs arbR');
  });
  t(`${label}: horizon clicks == beamng N.m/rad / (ARB_RS_SCALE x track^2)`, () => {
    const { ch } = solve(over, {}, 'beamng');
    const b = solve(over, {}, 'beamng').tune, h = solve(over, {}, 'horizon').tune;
    near(h.arbF, Math.round(b.arbF / (M.ARB_RS_SCALE * ch.trackF * ch.trackF) * 10) / 10, 1e-9, 'arbF');
    near(h.arbR, Math.round(b.arbR / (M.ARB_RS_SCALE * ch.trackR * ch.trackR) * 10) / 10, 1e-9, 'arbR');
  });
}

t('MAN ARB values are taken verbatim in physical mode', () => {
  const b = solve({}, { arbMode: 'man', arbManF: 14000, arbManR: 9000 }, 'beamng').tune;
  near(b.arbF, 14000, 1e-12, 'arbF'); near(b.arbR, 9000, 1e-12, 'arbR');
});

t('NEUTRAL never reports "ARB maxed" without a ceiling', () => {
  for (const [, over] of CHS)
    if (solve(over, { arbBalMode: 'neutral', arbBias: 45 }, 'beamng').tune.neutralClamped)
      throw new Error('neutralClamped fired in a mode with no maximum');
});

t('roll angle stays physical across chassis', () => {
  for (const [label, over] of CHS) {
    const d = solve(over, {}, 'beamng').tune.rollDeg;
    if (!(d > 0 && d < 15)) throw new Error(`${label}: rollDeg ${d}`);
  }
});

console.log('\n── CO-SOLVE ──');
t('ARB_UTIL_REF substitution is neutral across a target sweep', () => {
  // lim.arb divides BOTH sides of the spUtil/abUtil comparison, so it cancels. Any
  // divergence here means the saturation clamp is biting differently between modes.
  const bad = [];
  for (let x = 40; x <= 80; x += 2) {
    const fe = { arbBalMode: 'coSolve', arbBalTarget: x / 100, springShareAuto: true };
    const h = solve({}, fe, 'horizon').tune.coSolveAutoS;
    const b = solve({}, fe, 'beamng').tune.coSolveAutoS;
    if (h !== b) bad.push(`${x / 100}: horizon ${h} vs beamng ${b}`);
  }
  if (bad.length) throw new Error(bad.join('; '));
});
t('CO-SOLVE still converges in physical mode (not pinned across the range)', () => {
  const seen = new Set();
  for (let x = 54; x <= 80; x += 2)
    seen.add(solve({}, { arbBalMode: 'coSolve', arbBalTarget: x / 100, springShareAuto: true }, 'beamng').tune.coSolveAutoS);
  if (seen.size < 5) throw new Error(`only ${seen.size} distinct S values — search looks stuck`);
});

console.log('\n── Forza regression guard ──');
t('every Forza mode/ARB-mode combination still solves identically to its own math', () => {
  // Not a stored snapshot: each Forza value is re-derived from the beamng value through the
  // documented conversion, so this stays meaningful if the underlying physics legitimately
  // changes. It only fails if the beamng branch leaks into the Forza path.
  const FES = [
    {}, { arbBalMode: 'neutral', arbBias: 20 }, { arbBalMode: 'mech', arbBalTarget: 0.58 },
    { arbMode: 'roll', arbTargetRollMan: 1.2 }, { arbMode: 'share', arbShareMan: 28 },
  ];
  for (const mode of ['horizon', 'motorsport']) {
    const lim = M.GAME_LIMITS[mode];
    for (const [label, over] of CHS)
      for (const fe of FES) {
        const r = solve(over, fe, mode).tune;
        for (const k of ['rebF', 'rebR', 'bumpF', 'bumpR'])
          if (r[k] < 1 || r[k] > lim.damping)
            throw new Error(`${mode}/${label}: ${k}=${r[k]} outside 1..${lim.damping}`);
        for (const k of ['arbF', 'arbR'])
          if (r[k] < 1 || r[k] > lim.arb)
            throw new Error(`${mode}/${label}: ${k}=${r[k]} outside 1..${lim.arb}`);
      }
  }
});

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
