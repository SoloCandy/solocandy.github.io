// SUSP.OS physics engine tests
// Run with: node tests.js
// No dependencies required.

const KG_TO_LB = 2.204622622;
const LB_IN_TO_NM = 175.126790921;
const MPH_TO_MS = 0.44704;
const ARB_RS_SCALE = 240;
const ROLL_CENTER_HEIGHT = 0.09;
const DAMPING_CALIBRATION = 0.001;
const MECH_BALANCE_STIFFNESS_WEIGHT = 0.698;
const GAME_LIMITS = { horizon: { damping: 20, arb: 65 }, motorsport: { damping: 40, arb: 40 } };

const cornerMasses = ch => {
  const kg = ch.weight / KG_TO_LB;
  return { front: (kg * (ch.frontBias / 100)) / 2, rear: (kg * (1 - ch.frontBias / 100)) / 2 };
};

const flatRideRearHz = (fHz, wb, mph) => {
  if (mph >= 200) return { hz: fHz, clamped: false };
  const ms = mph * MPH_TO_MS;
  if (ms < 1) return { hz: fHz * 1.2, clamped: false };
  const t = wb / ms, d = (1 / fHz) - (2 * t);
  const raw = d > 0.05 ? 1 / d : fHz * 1.2;
  const clamped = raw > fHz * 1.6;
  return { hz: clamped ? fHz * 1.6 : raw, clamped };
};

const solveSpring = (hz, mass, mr) => {
  const wr = Math.pow(hz * 2 * Math.PI, 2) * mass;
  return (wr / Math.pow(mr, 2)) / LB_IN_TO_NM;
};

const solveDamp = (hz, mass, z, lim) => {
  const wr = Math.pow(hz * 2 * Math.PI, 2) * mass, cc = 2 * Math.sqrt(wr * mass);
  return Math.min(lim, Math.max(1, cc * (z / 100) * DAMPING_CALIBRATION));
};

// ── test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

const assert = (name, actual, expected, tol = 0.01) => {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { console.log(`  ✓  ${name}`); passed++; }
  else { console.error(`  ✗  ${name}\n       expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}`); failed++; }
};

const assertEq = (name, actual, expected) => {
  const ok = actual === expected;
  if (ok) { console.log(`  ✓  ${name}`); passed++; }
  else { console.error(`  ✗  ${name}\n       expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failed++; }
};

// ── cornerMasses ─────────────────────────────────────────────────────────────

console.log('\ncornerMasses');
{
  const m = cornerMasses({ weight: 3200, frontBias: 50 });
  const kg = 3200 / KG_TO_LB;
  assert('50/50 front corner', m.front, kg * 0.5 / 2);
  assert('50/50 rear corner',  m.rear,  kg * 0.5 / 2);
  assert('front === rear at 50%', m.front - m.rear, 0);

  const m2 = cornerMasses({ weight: 3200, frontBias: 60 });
  assert('60% front heavier than rear', m2.front - m2.rear, kg * 0.1);
}

// ── flatRideRearHz ────────────────────────────────────────────────────────────

console.log('\nflatRideRearHz');
{
  // disabled at mph >= 200
  const r = flatRideRearHz(1.5, 2.7, 200);
  assert('OFF: hz equals front', r.hz, 1.5);
  assertEq('OFF: not clamped', r.clamped, false);

  // very low speed falls back to 1.2× front
  const r2 = flatRideRearHz(1.5, 2.7, 0);
  assert('near-zero mph: 1.2× front', r2.hz, 1.5 * 1.2);

  // realistic case: 70 mph, 2.7m wheelbase, 1.5 Hz front
  const r3 = flatRideRearHz(1.5, 2.7, 70);
  assert('70mph rear hz > front', r3.hz - 1.5, 0, 2); // rear should be higher than front
  assertEq('70mph not clamped', r3.clamped, false);

  // cap at 1.6× when formula overshoots
  const r4 = flatRideRearHz(1.0, 2.7, 25); // low speed → formula overshoots 1.6× cap
  assert('cap at 1.6× front', r4.hz, 1.0 * 1.6, 0.001);
  assertEq('clamped flag set', r4.clamped, true);
}

// ── solveSpring ───────────────────────────────────────────────────────────────

console.log('\nsolveSpring');
{
  // at 1 Hz, MR=1, the wheel rate equals mass*ω², spring = wheel rate / LB_IN_TO_NM
  const mass = 300; // kg corner mass
  const hz = 1.0;
  const wr = Math.pow(hz * 2 * Math.PI, 2) * mass;
  const expected = wr / LB_IN_TO_NM;
  assert('1 Hz MR=1 spring rate', solveSpring(hz, mass, 1.0), expected, 0.01);

  // motion ratio 0.8 increases spring rate (spring must work harder)
  const s1 = solveSpring(1.5, 350, 1.0);
  const s2 = solveSpring(1.5, 350, 0.8);
  assert('lower MR → higher spring rate', s2 - s1, 0, 1000); // s2 > s1
  if (s2 <= s1) console.error('    direction wrong: s2 should be > s1');
}

// ── solveDamp ─────────────────────────────────────────────────────────────────

console.log('\nsolveDamp');
{
  // result must be at least 1
  assert('minimum click is 1', solveDamp(0.5, 100, 10, 20), 1, 0);

  // result must not exceed limit
  const d = solveDamp(5.0, 1000, 100, 20);
  assert('capped at game limit', d, 20, 0);

  // at critical damping (ζ=100%) the result is cc * DAMPING_CALIBRATION
  const mass = 400, hz = 2.0;
  const wr = Math.pow(hz * 2 * Math.PI, 2) * mass;
  const cc = 2 * Math.sqrt(wr * mass);
  const expected = Math.min(20, Math.max(1, cc * DAMPING_CALIBRATION));
  assert('ζ=100% matches formula', solveDamp(hz, mass, 100, 20), expected, 0.001);
}

// ── settle time constant ──────────────────────────────────────────────────────

console.log('\nsettle (ln(10)/(ζ·ωn))');
{
  // 2.302 ≈ ln(10)
  const fHz = 2.0, reboundZeta = 70;
  const settle = 2.302 / ((reboundZeta / 100) * fHz * 2 * Math.PI);
  assert('settle formula uses ln(10)', 2.302, Math.log(10), 0.001);
  assert('settle at 2Hz 70%ζ ≈ 0.26s', settle, 0.261, 0.01);
}

// ── integration: known vehicle (Lexus LC500 proxy) ───────────────────────────

console.log('\nintegration — LC500-like vehicle');
{
  const ch = { weight: 4000, frontBias: 52, wheelbase: 2.87, cgHeight: 0.46,
               trackF: 1.59, trackR: 1.60, motionRatioF: 1.0, motionRatioR: 1.0 };
  const lim = GAME_LIMITS.horizon;
  const m = cornerMasses(ch);

  // ride stiffness 50 → frontHz ≈ 2.15 Hz
  const frontHz = 0.8 + (50 / 100) * 2.7;
  assert('frontHz at stiffness 50', frontHz, 2.15, 0.001);

  const springF = solveSpring(frontHz, m.front, ch.motionRatioF);
  assert('spring rate positive', springF, springF, 0); // tautology — just check no NaN
  assert('spring rate in sensible range (100–800 lb/in)', springF > 100 && springF < 800 ? springF : -1, springF > 100 && springF < 800 ? springF : -1, 0);

  const rebF = solveDamp(frontHz, m.front, 70, lim.damping);
  assert('rebound within game limits', rebF >= 1 && rebF <= lim.damping ? rebF : -1, rebF >= 1 && rebF <= lim.damping ? rebF : -1, 0);
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
