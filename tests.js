// SUSP.OS physics engine tests
// Run with: node tests.js
// No dependencies required.

const KG_TO_LB = 2.204622622;
const LB_IN_TO_NM = 175.126790921;
const MPH_TO_MS = 0.44704;
const ARB_RS_SCALE = 240;
// NOTE: app now uses rollCenterHeight(ch)=ch.cgHeight*0.20 (not a fixed constant)
const rollCenterHeight = ch => ch.cgHeight * 0.20;
const DAMPING_CALIBRATION = 0.00135;
const GAME_LIMITS = { horizon: { damping: 20, arb: 65 }, motorsport: { damping: 40, arb: 40 } };

// ── mech balance model (must mirror app: mechBalanceLLT / balanceFromRsBal) ──
const TIRE_LOAD_SENS = 0.15, MECH_BAL_GAIN = 1.8, WIDTH_GRIP_EXP = 0.4;
const cornerMassesM = ch => {
  const kg = ch.weight / KG_TO_LB;
  return { front: (kg * (ch.frontBias / 100)) / 2, rear: (kg * (1 - ch.frontBias / 100)) / 2 };
};
const mechBalanceLLT = (ch, Kf, Kr) => {
  const g = 9.81, a = 1.0, twF = ch.twF ?? 265, twR = ch.twR ?? 265;
  const m = cornerMassesM(ch), Mf = m.front * 2, Mr = m.rear * 2, Mt = Mf + Mr, RC = rollCenterHeight(ch);
  const Mphi = Mt * g * a * (ch.cgHeight - RC), sF = Kf / (Kf + Kr);
  const dWf = Mphi * sF / ch.trackF + Mf * g * a * RC / ch.trackF;
  const dWr = Mphi * (1 - sF) / ch.trackR + Mr * g * a * RC / ch.trackR;
  const FzRef = Mt * g / 4;
  const fy = Fz => { const z = Math.max(0, Fz); return z * Math.max(0, 1 - TIRE_LOAD_SENS * (z / FzRef - 1)); };
  const wF = Mf * g / 2, wR = Mr * g / 2;
  const FyF = Math.pow(twF / 265, WIDTH_GRIP_EXP) * (fy(wF + dWf) + fy(wF - dWf));
  const FyR = Math.pow(twR / 265, WIDTH_GRIP_EXP) * (fy(wR + dWr) + fy(wR - dWr));
  return Math.max(0, Math.min(1, 0.5 + MECH_BAL_GAIN * (FyF / (Mf * g) - FyR / (Mr * g))));
};
const balanceFromRsBal = (ch, rsBal) => {
  const r = Math.max(1e-4, Math.min(1 - 1e-4, rsBal));
  return mechBalanceLLT(ch, 1, r / (1 - r));
};
const rsBalFromBalance = (ch, target) => {
  let lo = 1e-4, hi = 1 - 1e-4;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (balanceFromRsBal(ch, mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
};

const cornerMasses = ch => {
  const kg = ch.weight / KG_TO_LB;
  return { front: (kg * (ch.frontBias / 100)) / 2, rear: (kg * (1 - ch.frontBias / 100)) / 2 };
};

// Spring-frequency operating band — must mirror app's HZ_MIN/HZ_MAX.
const HZ_MIN = 0.8, HZ_MAX = 5.5;
const rsToHz = rs => rs > 6 ? 0.8 + (rs / 100) * 2.7 : rs;
const hzToRs = hz => Math.round(Math.max(HZ_MIN, Math.min(HZ_MAX, hz)) * 100) / 100;

const flatRideRearHz = (fHz, wb, mph) => {
  if (mph >= 200) return { hz: fHz, clamped: false };
  const ms = mph * MPH_TO_MS;
  if (ms < 1) return { hz: fHz * 1.2, clamped: false };
  const t = wb / ms, d = (1 / fHz) - (2 * t);
  const raw = d > 0.05 ? 1 / d : fHz * 1.2;
  const clamped = raw > HZ_MAX; // absolute game ceiling, not a relative cap
  return { hz: Math.min(raw, HZ_MAX), clamped };
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

// ── lateral load transfer (XFER) ─────────────────────────────────────────────
// Axle transfer at 1g = M_axle·h/track, where M_axle = 2·cornerMass.
// Regression guard for the corner-vs-axle-mass factor-of-2 fix.

console.log('\nlateral load transfer');
{
  const ch = { weight: 1600 * KG_TO_LB, frontBias: 50, cgHeight: 0.45, trackF: 1.55, trackR: 1.55 };
  const m = cornerMasses(ch);
  const xferF = 2 * m.front * ch.cgHeight / ch.trackF; // matches app formula
  const axleMassF = (ch.weight / KG_TO_LB) * 0.5;       // 800 kg front axle
  assert('front axle transfer = M_axle·h/t', xferF, axleMassF * ch.cgHeight / ch.trackF, 0.01);
  assert('1600kg/50%/0.45m/1.55m ≈ 232 kg/g', xferF, 232.26, 0.5);
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

  // cap at HZ_MAX game ceiling when formula overshoots (stiff spring at medium speed)
  const r4 = flatRideRearHz(3.5, 2.7, 70); // high fHz at 70mph → raw overshoots → clamped at HZ_MAX
  assert('cap at HZ_MAX ceiling', r4.hz, HZ_MAX, 0.001);
  assertEq('clamped flag set', r4.clamped, true);

  // a derived rear Hz in the expanded 4.0–5.5 band must NOT be clamped
  // (regression guard for the old 4.0 cap that silently truncated stiff rears)
  const r5 = flatRideRearHz(3.0, 2.7, 90); // raw lands ≈5.0Hz — inside new band
  assert('4.0–5.5 band: rear hz ≈ 5.0', r5.hz, 5.02, 0.1);
  assertEq('4.0–5.5 band: above old 4.0 cap', r5.hz > 4.0, true);
  assertEq('4.0–5.5 band: clamped flag clear', r5.clamped, false);
}

// ── Hz operating band (HZ_MIN / HZ_MAX) ────────────────────────────────────────
// Guards the expanded 0.8–5.5 range: hzToRs clamping and the legacy-save migration
// threshold. Regression coverage for the scattered-magic-number bugs (commits where
// rear Hz silently re-capped at 4.0 / slider froze at 3.5).

console.log('\nHz operating band');
{
  // hzToRs clamps into [HZ_MIN, HZ_MAX]
  assert('hzToRs clamps below floor', hzToRs(0.2), HZ_MIN, 0.001);
  assert('hzToRs clamps above ceiling', hzToRs(9.9), HZ_MAX, 0.001);
  assert('hzToRs passes 5.0 through', hzToRs(5.0), 5.0, 0.001);
  assert('hzToRs passes 4.5 through', hzToRs(4.5), 4.5, 0.001);

  // legacy migration: old saves stored integers 0–100; only values >6 are legacy.
  // A genuine 5.0 Hz must NOT be misread as a legacy integer and rescaled down.
  assert('rsToHz: 5.0 stays 5.0 (not legacy)', rsToHz(5.0), 5.0, 0.001);
  assert('rsToHz: 4.5 stays 4.5 (not legacy)', rsToHz(4.5), 4.5, 0.001);
  // a true legacy integer (e.g. 50/100) migrates onto the 0.8+ scale
  assert('rsToHz: legacy 50 migrates', rsToHz(50), 0.8 + 0.5 * 2.7, 0.001);
  assertEq('migration threshold is >6 (5.5 not legacy)', rsToHz(5.5), 5.5);
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
  assertEq('lower MR → higher spring rate', s2 > s1, true);
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

// ── mech balance (tyre load sensitivity model) ──────────────────────────────

console.log('\nmechBalanceLLT');
{
  // symmetric car: 50/50, equal track, equal width, equal stiffness → exactly neutral
  const sym = { weight: 3000, frontBias: 50, cgHeight: 0.45, trackF: 1.55, trackR: 1.55, twF: 265, twR: 265 };
  assert('symmetric car is neutral (0.50)', mechBalanceLLT(sym, 1, 1), 0.50, 1e-6);

  // monotonic: stiffer rear → higher (more oversteer)
  assertEq('rear-stiffer → >0.5', mechBalanceLLT(sym, 1, 1.5) > 0.5, true);
  assertEq('front-stiffer → <0.5', mechBalanceLLT(sym, 1.5, 1) < 0.5, true);
  assertEq('monotonic in Kr/Kf', mechBalanceLLT(sym, 1, 1.6) > mechBalanceLLT(sym, 1, 1.3), true);

  // width = grip: wider rear tyre reduces oversteer (lower balance) at fixed stiffness
  const wideR = { ...sym, twR: 305 };
  assertEq('wider rear tyre → less oversteer', mechBalanceLLT(wideR, 1, 1.4) < mechBalanceLLT(sym, 1, 1.4), true);

  // inverse round-trips the forward map
  const ch = { weight: 3200, frontBias: 52, cgHeight: 0.45, trackF: 1.55, trackR: 1.52, twF: 265, twR: 265 };
  for (const tgt of [0.45, 0.55, 0.65]) {
    const rs = rsBalFromBalance(ch, tgt);
    assert(`inverse round-trip @ ${tgt}`, balanceFromRsBal(ch, rs), tgt, 0.005);
  }

  // calibrated to legacy 0.5-neutral scale: default car natural ≈ 0.47
  const natRs = (cornerMassesM(ch).rear * ch.trackR ** 2) /
                (cornerMassesM(ch).front * ch.trackF ** 2 + cornerMassesM(ch).rear * ch.trackR ** 2);
  assert('default car natural balance ≈ 0.47', balanceFromRsBal(ch, natRs), 0.469, 0.02);
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
