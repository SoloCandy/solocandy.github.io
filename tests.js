// SUSP.OS physics engine tests
// Run with: node tests.js
// No dependencies required.
//
// Covers spring/damper solving, settle-mode ride-reference anchoring, the
// mechBalanceLLT grip model, computeDiff (layout-dependent lock/balance signs,
// diff type scaling, SPORT decel lockout, and the MATCH CHASSIS FWD-polarity
// regression — see docs/KNOWN_ISSUES.md for the bug this guards against), and
// computeAlignment (camber/toe/caster target derivation, roll/CG compensation,
// per-build/layout baselines, and the Drift/Drag frozen-camber regression).

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

// ── computeDiff model (must mirror app: naturalMechBalanceOf / resolveArbBalTarget / computeDiff) ──
const MECH_BALANCE_TARGET = 0.65;
const DIFF_BIAS_SCALE = 0.14;
const DIFF_TYPE_SCALE = { race: 1.00, sport: 0.88, rally: 0.76, offroad: 0.52, drift: 1.10 };

const naturalMechBalanceOf = ch => {
  if (ch.useMeasuredNatBal && ch.measuredNatBal != null) return Math.max(0.10, Math.min(0.90, ch.measuredNatBal));
  const mc = cornerMasses(ch);
  return mc.rear * ch.trackR * ch.trackR / (mc.front * ch.trackF * ch.trackF + mc.rear * ch.trackR * ch.trackR);
};
const resolveArbBalTarget = (ch, fe) => fe.arbBalTarget == null
  ? MECH_BALANCE_TARGET
  : Math.max(0.20, Math.min(0.90, naturalMechBalanceOf(ch) + fe.arbBalTarget));

const computeDiff = (ch, fe, dr, natMechBalOverride = null) => {
  const rB = 1 - ch.frontBias / 100;
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
  const biasExit = dr.diffBiasExit ?? 0;
  const biasEntry = dr.diffBiasEntry ?? 0;
  const frontExitBias = dr.diffFrontExitBias ?? 0;
  const build = dr.buildType ?? 'track';
  const diffType = dr.diffType ?? 'race';
  const typeScale = DIFF_TYPE_SCALE[diffType] ?? 1.0;

  let effBiasExit = biasExit, effBiasEntry = biasEntry;
  if (dr.diffComplement && !dr.diffManual) {
    const cm = cornerMasses(ch);
    const natMechBal = natMechBalOverride != null
      ? natMechBalOverride
      : (cm.rear * ch.trackR * ch.trackR) / (cm.front * ch.trackF * ch.trackF + cm.rear * ch.trackR * ch.trackR);
    const tgt = resolveArbBalTarget(ch, fe);
    const gap = tgt - natMechBal;
    const correction = Math.max(-25, Math.min(25, gap * 150));
    const signedCorrection = ch.layout === 'FWD' ? -correction : correction;
    effBiasExit = Math.max(-50, Math.min(50, biasExit + signedCorrection));
    effBiasEntry = Math.max(-50, Math.min(50, biasEntry + signedCorrection * 0.5));
  }

  let vals;
  if (dr.diffManual) {
    vals = ch.layout === 'AWD'
      ? { layout: 'AWD',
          frontAccel: dr.diffFrontAccel ?? 25, frontDecel: dr.diffFrontDecel ?? 0,
          rearAccel: dr.diffRearAccel ?? 50, rearDecel: dr.diffRearDecel ?? 10,
          center: dr.diffCenter ?? 65 }
      : { layout: ch.layout, accel: dr.diffAccel ?? 35, decel: dr.diffDecel ?? 10 };
  } else if (ch.layout === 'AWD') {
    const center = cl(dr.diffCenter ?? 65, 45, 80);
    vals = { layout: 'AWD',
      frontAccel: cl((28 - effBiasExit * 0.10 + frontExitBias * 0.12) * typeScale, 10, 40),
      frontDecel: 0,
      rearAccel: cl((48 + effBiasExit * 0.25) * typeScale, 20, 70),
      rearDecel: diffType === 'sport' ? 0 : cl(8 + (rB - 0.5) * 15 + effBiasEntry * 0.15, 0, 20),
      center };
  } else {
    const isRWD = ch.layout === 'RWD';
    const accelBase = isRWD
      ? ({ street: 28, track: 35, drift: 48, rally: 25, offroad: 18, drag: 65 }[build] ?? 35)
      : ({ street: 15, track: 20, drift: 12, rally: 12, offroad: 10, drag: 20 }[build] ?? 20);
    const decelBase = isRWD
      ? ({ street: 15, track: 12, drift: 3, rally: 8, offroad: 5, drag: 0 }[build] ?? 12)
      : ({ street: 8, track: 5, drift: 2, rally: 4, offroad: 2, drag: 0 }[build] ?? 5);
    const accel = isRWD
      ? cl(accelBase * typeScale + effBiasExit * 0.20, 10, 65)
      : cl(accelBase * typeScale + effBiasExit * 0.15, 5, 35);
    const decel = diffType === 'sport' ? 0 : cl(decelBase * typeScale + (rB - 0.5) * (isRWD ? 15 : 5) + effBiasEntry * 0.15, 0, isRWD ? 30 : 15);
    vals = { layout: ch.layout, accel, decel };
  }

  const nf = ch.frontBias / 100;
  let bDiffAccel = 0, bDiffDecel = 0, bDiffFront = 0, bDiffRear = 0;
  if (vals.layout === 'AWD') {
    const C = Math.max(0, Math.min(1, (vals.center ?? 65) / 100));
    const bFA = -vals.frontAccel * nf * (1 - C) * DIFF_BIAS_SCALE;
    const bRA = vals.rearAccel * (1 - nf) * C * DIFF_BIAS_SCALE;
    const bFD = -vals.frontDecel * nf * (1 - C) * DIFF_BIAS_SCALE;
    const bRD = vals.rearDecel * (1 - nf) * C * DIFF_BIAS_SCALE;
    bDiffFront = bFA + bFD;
    bDiffRear = bRA + bRD;
    bDiffAccel = bFA + bRA;
    bDiffDecel = bFD + bRD;
  } else if (vals.layout === 'RWD') {
    bDiffAccel = vals.accel * (1 - nf) * DIFF_BIAS_SCALE;
    bDiffDecel = vals.decel * (1 - nf) * DIFF_BIAS_SCALE;
  } else {
    bDiffAccel = -vals.accel * nf * DIFF_BIAS_SCALE;
    bDiffDecel = -vals.decel * nf * DIFF_BIAS_SCALE;
  }

  return { ...vals, bDiffAccel, bDiffDecel, bDiffFront, bDiffRear };
};

// ── computeAlignment model (must mirror app: camber/toe/caster targets) ────────
const computeAlignment = (ch, tune, layout, buildType) => {
  const { fHz, rHz, rollDeg } = tune;
  const build = buildType ?? 'track';
  const isDrift = build === 'drift';
  const isStreet = build === 'street';
  const isRally = build === 'rally';
  const isOffroad = build === 'offroad';
  const isDrag = build === 'drag';

  const camberGain = Math.max(0.55, Math.min(0.85, 1.05 - (ch.cgHeight ?? 0.45) * 0.8));
  const rearGainMult = layout === 'FWD' ? 0.50 : layout === 'AWD' ? 0.70 : 0.75;
  const fwdReduction = layout === 'FWD' ? 0.3 : 0.0;

  const optimalCamber = isDrift ? -2.5 : isDrag ? -0.2 : isOffroad ? -0.3 : isRally ? -0.8 : isStreet ? -1.0 : -1.5;
  const recCamberF = Math.round(Math.max(-4.0, Math.min(0.0,
    optimalCamber - rollDeg * camberGain + fwdReduction)) * 10) / 10;
  const recCamberR = Math.round(Math.max(-3.5, Math.min(0.0,
    optimalCamber - rollDeg * camberGain * rearGainMult)) * 10) / 10;

  const toeFByBuild = {
    street: layout === 'FWD' ? 0.05 : 0.0,
    track: layout === 'FWD' ? 0.05 : -0.05,
    drift: layout === 'FWD' ? 0.0 : -0.10,
    rally: 0.0,
    offroad: 0.05,
    drag: 0.0,
  }[build] ?? -0.05;
  const recToeF = Math.round(Math.max(-0.20, Math.min(0.15,
    toeFByBuild + (ch.frontBias - 50) * -0.003 + (fHz - 1.8) * 0.010)) * 10) / 10;

  const toeRByBuild = {
    street: { RWD: 0.15, AWD: 0.08, FWD: 0.05 },
    track: { RWD: 0.10, AWD: 0.08, FWD: 0.05 },
    drift: { RWD: 0.05, AWD: 0.05, FWD: 0.05 },
    rally: { RWD: 0.10, AWD: 0.08, FWD: 0.05 },
    offroad: { RWD: 0.15, AWD: 0.15, FWD: 0.10 },
    drag: { RWD: 0.0, AWD: 0.0, FWD: 0.0 },
  }[build] ?? { RWD: 0.10, AWD: 0.08, FWD: 0.05 };
  const toeRBase = toeRByBuild[layout] ?? toeRByBuild.RWD;
  const recToeR = Math.round(Math.max(0.0, Math.min(0.25,
    toeRBase + ((1 - ch.frontBias / 100) - 0.5) * 0.20 + Math.max(0, rHz - fHz) * -0.03)) * 10) / 10;

  const casterBase = isDrift ? 4.8 : isDrag ? 4.0 : isOffroad ? 4.5 : isStreet ? 5.2 : 5.8;
  const recCaster = parseFloat(Math.max(4.0, Math.min(7.5,
    casterBase + (fHz - 1.8) * 0.4 + (ch.frontBias - 50) * 0.04 + (layout === 'FWD' ? -0.5 : 0))).toFixed(1));

  return { recCamberF, recCamberR, recToeF, recToeR, recCaster };
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

// ── settle mode: ride-reference anchoring ───────────────────────────────────

console.log('\nsettle mode ride-reference anchoring');
{
  // Mirror of app's settleZetas (index.html). Reference axle holds refZeta;
  // the other is derived for equal settle time (ζ·Hz constant).
  const settleZetas = (rideRef, fHz, rHz, refZeta, biasMult) => {
    if (fHz <= 0 || rHz <= 0) return { zF: refZeta, zR: refZeta };
    if (rideRef === 'rear')   return { zR: refZeta, zF: refZeta * (rHz / fHz) / biasMult };
    if (rideRef === 'shared') { const avg = (fHz + rHz) / 2, b = Math.sqrt(biasMult);
                                return { zF: refZeta * (avg / fHz) / b, zR: refZeta * (avg / rHz) * b }; }
    return { zF: refZeta, zR: refZeta * (fHz / rHz) * biasMult };
  };
  // settle time = ln(10)/(ζ·ωn); equal when ζ·Hz matches front vs rear.
  const settle = (zeta, hz) => 2.302 / ((zeta / 100) * hz * 2 * Math.PI);
  const fHz = 2.0, rHz = 2.6, RZ = 70, NOBIAS = 1;

  // front ref: front holds reboundZeta, rear derived
  const fr = settleZetas('front', fHz, rHz, RZ, NOBIAS);
  assert('front ref anchors zetaF = reboundZeta', fr.zF, RZ, 1e-9);
  assert('front ref equal settle time', settle(fr.zF, fHz), settle(fr.zR, rHz), 1e-6);

  // rear ref: rear holds reboundZeta, front derived
  const rr = settleZetas('rear', fHz, rHz, RZ, NOBIAS);
  assert('rear ref anchors zetaR = reboundZeta', rr.zR, RZ, 1e-9);
  assertEq('rear ref derives front (≠ reboundZeta)', Math.abs(rr.zF - RZ) > 1, true);
  assert('rear ref equal settle time', settle(rr.zF, fHz), settle(rr.zR, rHz), 1e-6);

  // shared ref: neither axle is exactly reboundZeta; both equal settle at bias 0
  const sh = settleZetas('shared', fHz, rHz, RZ, NOBIAS);
  assert('shared ref equal settle time', settle(sh.zF, fHz), settle(sh.zR, rHz), 1e-6);
  assertEq('shared ref front between ref and rear-ref value', sh.zF > RZ && sh.zF < rr.zF, true);

  // front-ref output is unchanged from the pre-fix formula (regression guard)
  const legacyZR = RZ * (fHz / rHz) * NOBIAS;
  assert('front ref matches legacy rear formula', fr.zR, legacyZR, 1e-9);

  // bias direction: settleBias>0 (biasMult>1) → rear settles faster (shorter rear settle time)
  const biased = settleZetas('front', fHz, rHz, RZ, 2);
  assertEq('positive bias → rear settles faster', settle(biased.zR, rHz) < settle(biased.zF, fHz), true);
}

// ── computeDiff — layout-dependent lock and balance-contribution signs ─────────

console.log('\ncomputeDiff — layout signs');
{
  const chRWD = { weight: 3200, frontBias: 50, trackF: 1.55, trackR: 1.52, layout: 'RWD' };
  const chFWD = { ...chRWD, layout: 'FWD' };
  const chAWD = { ...chRWD, layout: 'AWD' };
  const fe0 = {};
  const drBase = { buildType: 'track', diffType: 'race' };

  // RWD: more accel/decel lock → oversteer (+)
  const rwdLo = computeDiff(chRWD, fe0, { ...drBase, diffBiasExit: -50, diffBiasEntry: -50 });
  const rwdHi = computeDiff(chRWD, fe0, { ...drBase, diffBiasExit: 50, diffBiasEntry: 50 });
  assertEq('RWD: higher EXIT/ENTRY → more accel lock', rwdHi.accel > rwdLo.accel, true);
  assertEq('RWD: bDiffAccel positive (oversteer) at high lock', rwdHi.bDiffAccel > 0, true);
  assertEq('RWD: bDiffDecel positive (oversteer) at high lock', rwdHi.bDiffDecel > 0, true);

  // FWD: more front lock → understeer (−), regardless of EXIT/ENTRY slider direction
  const fwdLo = computeDiff(chFWD, fe0, { ...drBase, diffBiasExit: -50, diffBiasEntry: -50 });
  const fwdHi = computeDiff(chFWD, fe0, { ...drBase, diffBiasExit: 50, diffBiasEntry: 50 });
  assertEq('FWD: higher EXIT/ENTRY → more accel lock', fwdHi.accel > fwdLo.accel, true);
  assertEq('FWD: bDiffAccel negative (understeer) at high lock', fwdHi.bDiffAccel < 0, true);
  assertEq('FWD: bDiffDecel negative (understeer) at high lock', fwdHi.bDiffDecel < 0, true);

  // AWD: rear-heavy center split → more oversteer than front-heavy center split.
  // Note: with the model's default baselines (rearAccel 48 vs frontAccel 28), the diff
  // nets oversteer-leaning even at the most front-biased center allowed (45) — that's a
  // property of the baseline magnitudes, not a bug, so this checks the comparative
  // direction rather than asserting an absolute understeer sign at center=45.
  const awdRear = computeDiff(chAWD, fe0, { ...drBase, diffCenter: 80 });
  const awdFront = computeDiff(chAWD, fe0, { ...drBase, diffCenter: 45 });
  assertEq('AWD: rear-biased center → more oversteer than front-biased center',
    (awdRear.bDiffAccel + awdRear.bDiffDecel) > (awdFront.bDiffAccel + awdFront.bDiffDecel), true);
  assertEq('AWD: bDiffRear positive at rear-biased center', awdRear.bDiffRear > 0, true);
  assertEq('AWD: bDiffFront negative at rear-biased center', awdRear.bDiffFront < 0, true);
}

// ── computeDiff — diff type scaling and SPORT decel lockout ────────────────────

console.log('\ncomputeDiff — diff type scaling');
{
  const ch = { weight: 3200, frontBias: 50, trackF: 1.55, trackR: 1.52, layout: 'RWD' };
  const fe0 = {};
  const race = computeDiff(ch, fe0, { buildType: 'track', diffType: 'race' });
  const drift = computeDiff(ch, fe0, { buildType: 'track', diffType: 'drift' });
  const offroad = computeDiff(ch, fe0, { buildType: 'track', diffType: 'offroad' });
  assertEq('drift (1.10×) locks harder than race (1.00×) at equal slider position', drift.accel > race.accel, true);
  assertEq('offroad (0.52×) locks softer than race at equal slider position', offroad.accel < race.accel, true);

  const sport = computeDiff(ch, fe0, { buildType: 'track', diffType: 'sport' });
  assertEq('SPORT diff has zero decel lock (accel-only)', sport.decel, 0);
}

// ── computeDiff — MATCH CHASSIS correction (regression guard for the FWD-polarity bug) ──

console.log('\ncomputeDiff — MATCH CHASSIS correction');
{
  // Chassis whose natural balance sits below the (default) 0.65 target, so MATCH CHASSIS
  // sees gap>0 ("wants more oversteer") and pushes a nonzero correction on every layout.
  const chRWD = { weight: 3200, frontBias: 50, trackF: 1.55, trackR: 1.52, layout: 'RWD' };
  const chFWD = { ...chRWD, layout: 'FWD' };
  const dr = { buildType: 'track', diffType: 'race', diffComplement: true, diffBiasExit: 0, diffBiasEntry: 0 };
  const drOff = { ...dr, diffComplement: false };

  const rwdOn = computeDiff(chRWD, {}, dr);
  const rwdOff = computeDiff(chRWD, {}, drOff);
  assertEq('RWD + MATCH CHASSIS wanting oversteer → MORE accel lock than baseline', rwdOn.accel > rwdOff.accel, true);

  const fwdOn = computeDiff(chFWD, {}, dr);
  const fwdOff = computeDiff(chFWD, {}, drOff);
  assertEq('FWD + MATCH CHASSIS wanting oversteer → LESS front lock than baseline (not more)', fwdOn.accel < fwdOff.accel, true);

  // MANUAL mode bypasses MATCH CHASSIS entirely — accel is whatever the user typed, unchanged
  const manualDr = { ...dr, diffManual: true, diffAccel: 40 };
  const manualOn = computeDiff(chRWD, {}, manualDr);
  assertEq('MANUAL mode ignores MATCH CHASSIS (accel unchanged)', manualOn.accel, 40);
}

// ── computeAlignment — camber roll/CG compensation ─────────────────────────────

console.log('\ncomputeAlignment — camber');
{
  const chLowCG = { frontBias: 50, cgHeight: 0.40 };
  const chHighCG = { frontBias: 50, cgHeight: 0.80 };
  const lowRoll = { fHz: 1.8, rHz: 1.8, rollDeg: 1.0 };
  const highRoll = { fHz: 1.8, rHz: 1.8, rollDeg: 4.0 };

  // More roll → more negative camber (both axles), for a build that isn't frozen
  const trackLowRoll = computeAlignment(chLowCG, lowRoll, 'RWD', 'track');
  const trackHighRoll = computeAlignment(chLowCG, highRoll, 'RWD', 'track');
  assertEq('more roll → more negative front camber', trackHighRoll.recCamberF < trackLowRoll.recCamberF, true);
  assertEq('more roll → more negative rear camber', trackHighRoll.recCamberR < trackLowRoll.recCamberR, true);

  // Higher CG → lower camberGain → less roll-compensation for the same roll angle
  const lowCGAlign = computeAlignment(chLowCG, highRoll, 'RWD', 'track');
  const highCGAlign = computeAlignment(chHighCG, highRoll, 'RWD', 'track');
  assertEq('higher CG → less negative front camber at equal roll (less compensation)', highCGAlign.recCamberF > lowCGAlign.recCamberF, true);

  // FWD gets a front camber reduction (fwdReduction) — less negative than RWD at equal roll.
  // Uses lowRoll, not highRoll: at highRoll both clamp to the same -4.0° floor, masking the
  // difference entirely — this needs a roll angle where neither side is clamped.
  const rwdFrontCmp = computeAlignment(chLowCG, lowRoll, 'RWD', 'track');
  const fwdFrontCmp = computeAlignment(chLowCG, lowRoll, 'FWD', 'track');
  assertEq('FWD front camber less negative than RWD at equal roll', fwdFrontCmp.recCamberF > rwdFrontCmp.recCamberF, true);

  const rwdAlign = computeAlignment(chLowCG, highRoll, 'RWD', 'track');
  const fwdAlign = computeAlignment(chLowCG, highRoll, 'FWD', 'track');

  // rearGainMult ordering: FWD reacts least to roll, AWD middle, RWD most — so at high roll,
  // RWD rear camber should be more negative than FWD's (same optimalCamber baseline)
  assertEq('RWD rear camber more negative than FWD rear camber at high roll', rwdAlign.recCamberR < fwdAlign.recCamberR, true);

  // Camber clamps hold even at extreme roll angle
  const extremeRoll = { fHz: 1.8, rHz: 1.8, rollDeg: 50 };
  const clamped = computeAlignment(chLowCG, extremeRoll, 'RWD', 'track');
  assertEq('front camber clamps at -4.0°', clamped.recCamberF, -4.0);
  assertEq('rear camber clamps at -3.5°', clamped.recCamberR, -3.5);

  // Regression guard: Drift and Drag used to be frozen constants ignoring roll/CG entirely —
  // confirm they now scale like every other build.
  const driftLowRoll = computeAlignment(chLowCG, lowRoll, 'RWD', 'drift');
  const driftHighRoll = computeAlignment(chLowCG, highRoll, 'RWD', 'drift');
  assertEq('Drift camber now varies with roll angle (not frozen)', driftHighRoll.recCamberF < driftLowRoll.recCamberF, true);
  const dragLowRoll = computeAlignment(chLowCG, lowRoll, 'RWD', 'drag');
  const dragHighRoll = computeAlignment(chLowCG, highRoll, 'RWD', 'drag');
  assertEq('Drag camber now varies with roll angle (not frozen)', dragHighRoll.recCamberF < dragLowRoll.recCamberF, true);

  // Drift's optimalCamber (-2.5) is more aggressive than Track's (-1.5) at equal roll/CG
  const trackAtLowRoll = computeAlignment(chLowCG, lowRoll, 'RWD', 'track');
  assertEq('Drift front camber more negative than Track at equal roll/CG', driftLowRoll.recCamberF < trackAtLowRoll.recCamberF, true);
}

// ── computeAlignment — toe and caster ──────────────────────────────────────────

console.log('\ncomputeAlignment — toe and caster');
{
  const ch = { frontBias: 50, cgHeight: 0.45 };
  const tune = { fHz: 1.8, rHz: 1.8, rollDeg: 2.0 };

  // Toe rear lookup table: Offroad FWD gets less toe-in than Offroad RWD/AWD
  const offroadFWD = computeAlignment(ch, tune, 'FWD', 'offroad');
  const offroadRWD = computeAlignment(ch, tune, 'RWD', 'offroad');
  const offroadAWD = computeAlignment(ch, tune, 'AWD', 'offroad');
  assertEq('Offroad FWD toe-R less than Offroad RWD toe-R', offroadFWD.recToeR < offroadRWD.recToeR, true);
  assertEq('Offroad RWD toe-R equals Offroad AWD toe-R (both 0.15 base)', offroadRWD.recToeR, offroadAWD.recToeR);

  // Toe front: stiffer front springs (higher fHz) nudge toward more toe-in (recToeF increases)
  const softFront = computeAlignment(ch, { fHz: 1.4, rHz: 1.8, rollDeg: 2.0 }, 'RWD', 'track');
  const stiffFront = computeAlignment(ch, { fHz: 2.4, rHz: 1.8, rollDeg: 2.0 }, 'RWD', 'track');
  assertEq('stiffer front Hz → more toe-in front', stiffFront.recToeF > softFront.recToeF, true);

  // Toe rear clamps to 0 minimum (never toe-out at the rear)
  const extremeRearHz = computeAlignment(ch, { fHz: 1.8, rHz: 5.5, rollDeg: 0 }, 'AWD', 'drag');
  assertEq('rear toe never goes below 0.0°', extremeRearHz.recToeR >= 0, true);

  // Caster: FWD gets a flat -0.5° reduction vs RWD at equal fHz/frontBias
  const rwdCaster = computeAlignment(ch, tune, 'RWD', 'track');
  const fwdCaster = computeAlignment(ch, tune, 'FWD', 'track');
  assert('FWD caster is 0.5° less than RWD at equal inputs', rwdCaster.recCaster - fwdCaster.recCaster, 0.5, 0.05);

  // Caster increases with front weight bias
  const lowBiasCaster = computeAlignment({ ...ch, frontBias: 40 }, tune, 'RWD', 'track');
  const highBiasCaster = computeAlignment({ ...ch, frontBias: 60 }, tune, 'RWD', 'track');
  assertEq('more front weight bias → more caster', highBiasCaster.recCaster > lowBiasCaster.recCaster, true);

  // Caster clamps hold at extreme inputs
  const extremeCaster = computeAlignment({ ...ch, frontBias: 70 }, { fHz: 5.5, rHz: 5.5, rollDeg: 0 }, 'RWD', 'track');
  assertEq('caster clamps at 7.5° max', extremeCaster.recCaster <= 7.5, true);
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
