'use strict';

/**
 * pf-engine.js — Power Flow Analysis Engine (Multi-method)
 *
 * Supports:
 *   Newton-Raphson (NR)    — full Jacobian, quadratic convergence
 *   Fast-Decoupled XB      — decoupled P-θ / Q-V, faster per iteration
 *   Fast-Decoupled BX      — alternative decoupled formulation
 *   DC Load Flow           — linear, angle-only, no reactive power
 *   Gauss-Seidel (GS)      — simple iterative, slower convergence
 *
 * Bus types:
 *   SLACK — utility / grid. V magnitude and angle fixed.
 *   PV    — generator buses. P and |V| specified.
 *   PQ    — all other buses. P and Q specified.
 *
 * Per-unit system: Sb = configurable (default 100 MVA). Vb = nominal bus voltage.
 */

/* ═══════════════════════════════════════════════════════
   STUDY CONFIGURATION  (shared mutable config object)
   ═══════════════════════════════════════════════════════ */

const PF_CONFIG = {
  method:    'nr',      // 'nr' | 'fdxb' | 'fdbx' | 'dc' | 'gs'
  tolerance: 1e-6,
  maxIter:   50,
  baseMVA:   100,
  overlay:   'both',   // 'voltage' | 'both' | 'none'
};

/* ═══════════════════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════════════════ */

function runPowerFlow() {
  try {
    // Read config from study panel if present
    _readStudyConfig();

    const { buses, branches, warnings } = buildNetwork();

    if (buses.length === 0) {
      showPFError('No buses found. Add Bus, Generator, or Utility components and connect them.');
      return;
    }
    const slackBuses = buses.filter(b => b.type === 'SLACK');
    if (slackBuses.length === 0) {
      showPFError('No slack bus found. Add a Utility (Grid) component and connect it to the network.');
      return;
    }
    if (buses.length < 2) {
      showPFError('Need at least 2 buses. Add more components and connect them.');
      return;
    }

    // Report voltage warnings before solving
    if (warnings.length > 0) {
      console.warn('[PF] Voltage mismatch warnings:', warnings);
    }

    let result;
    const method = PF_CONFIG.method;
    const BASE   = PF_CONFIG.baseMVA;

    if (method === 'dc') {
      result = solveDCLoadFlow(buses, branches, BASE);
    } else if (method === 'gs') {
      result = solveGaussSeidel(buses, branches, BASE);
    } else if (method === 'fdxb' || method === 'fdbx') {
      result = solveFastDecoupled(buses, branches, BASE, method);
    } else {
      result = solveNewtonRaphson(buses, branches, BASE);
    }

    result.warnings = warnings;
    showPFResults(result, buses, branches);

    if (PF_CONFIG.overlay !== 'none') {
      applyVoltageOverlay(result.buses, result.branches, PF_CONFIG.overlay);
    }

  } catch (err) {
    showPFError('Power flow error: ' + err.message);
    console.error(err);
  }
}

function _readStudyConfig() {
  const meth = document.getElementById('pf-method');
  const tol  = document.getElementById('pf-tolerance');
  const iter = document.getElementById('pf-max-iter');
  const base = document.getElementById('pf-base-mva');
  const over = document.getElementById('pf-overlay');
  if (meth) PF_CONFIG.method    = meth.value;
  if (tol)  PF_CONFIG.tolerance = parseFloat(tol.value) || 1e-6;
  if (iter) PF_CONFIG.maxIter   = parseInt(iter.value)  || 50;
  if (base) PF_CONFIG.baseMVA   = parseFloat(base.value)|| 100;
  if (over) PF_CONFIG.overlay   = over.value;
}

/* ═══════════════════════════════════════════════════════
   NETWORK EXTRACTION
   ═══════════════════════════════════════════════════════ */

function buildNetwork() {
  const buses    = [];
  const branches = [];
  const warnings = [];

  const nodeComps   = new Set(['bus', 'utility', 'generator', 'load', 'motor']);
  const branchComps = new Set(['line', 'cable', 'transformer2w', 'transformer3w']);
  const passComps   = new Set(['cb', 'disconnector', 'fuse', 'ct', 'vt',
                               'relay_oc', 'relay_diff', 'relay_dist', 'relay_ef']);

  // Adjacency map
  const adj = {};
  for (const c of state.components) adj[c.id] = new Set();
  for (const w of state.wires) {
    const fc = getComp(w.from.compId);
    const tc = getComp(w.to.compId);
    if (!fc || !tc) continue;
    adj[w.from.compId].add(w.to.compId);
    adj[w.to.compId].add(w.from.compId);
  }

  // BFS to group components into buses
  const busOf = {};
  let busIdx  = 0;

  for (const c of state.components) {
    if (!(nodeComps.has(c.type) || passComps.has(c.type))) continue;
    if (busOf[c.id] !== undefined) continue;

    const queue     = [c.id];
    const visited   = new Set([c.id]);
    const nodeGroup = [];

    while (queue.length) {
      const curr = queue.shift();
      const comp = getComp(curr);
      if (!comp) continue;
      nodeGroup.push(curr);
      busOf[curr] = busIdx;
      for (const nId of adj[curr]) {
        if (visited.has(nId)) continue;
        const nComp = getComp(nId);
        if (!nComp) continue;
        if (passComps.has(nComp.type) || nodeComps.has(nComp.type)) {
          visited.add(nId);
          queue.push(nId);
        }
      }
    }

    let busType = 'PQ', kv = 11, vInit = 1.0, angleInit = 0;
    let pSched = 0, qSched = 0, pGen = 0, vSpec = 1.0;
    let qMax = 9999, qMin = -9999, busName = null;

    for (const nId of nodeGroup) {
      const nc = getComp(nId);
      if (!nc) continue;
      const p = nc.props || {};
      if (nc.type === 'utility') {
        busType    = 'SLACK';
        kv         = parseFloat(p.kv) || 132;
        vSpec      = parseFloat(p.v_pu) || 1.0;
        angleInit  = (parseFloat(p.angle) || 0) * Math.PI / 180;
        busName    = nc.name;
      } else if (nc.type === 'generator' && busType !== 'SLACK') {
        busType = 'PV';
        kv      = parseFloat(p.kv) || 11;
        pGen    = parseFloat(p.pg) || 80;
        vSpec   = parseFloat(p.vg) || 1.0;
        qMax    = parseFloat(p.qmax) || 9999;
        qMin    = parseFloat(p.qmin) || -9999;
        busName = busName || nc.name;
      } else if (nc.type === 'bus') {
        kv = kv || (parseFloat(p.kv) || 11);
        if (p.bus_type === 'Slack') busType = 'SLACK';
        else if (p.bus_type === 'PV' && busType !== 'SLACK') busType = 'PV';
        busName = busName || nc.name;
        vInit   = parseFloat(p.v_init) || 1.0;
      } else if (nc.type === 'load') {
        pSched += parseFloat(p.mw)   || 0;
        qSched += parseFloat(p.mvar) || 0;
        kv = kv || (parseFloat(p.kv) || 0.4);
        busName = busName || nc.name;
      } else if (nc.type === 'motor') {
        const kw  = parseFloat(p.kw)  || 0;
        const eff = (parseFloat(p.eff) || 95) / 100;
        const pf  = parseFloat(p.pf)  || 0.87;
        const mw  = kw / 1000 / eff;
        pSched += mw;
        qSched += mw * Math.tan(Math.acos(pf));
        kv = kv || (parseFloat(p.kv) || 0.4);
        busName = busName || nc.name;
      }
    }

    const BASE = PF_CONFIG.baseMVA;
    buses.push({
      idx:        busIdx,
      id:         busIdx,
      name:       busName || ('Bus ' + (busIdx + 1)),
      type:       busType,
      kv,
      vInit:      busType === 'SLACK' ? vSpec : (vInit || 1.0),
      vSpec,
      angleInit,
      pSched:     (pGen - pSched) / BASE,
      qSched:     (-qSched) / BASE,
      qMax:       qMax / BASE,
      qMin:       qMin / BASE,
      nodeGroup,
    });
    busIdx++;
  }

  // Build branches
  for (const c of state.components) {
    if (!branchComps.has(c.type)) continue;

    const connectedBuses = new Set();
    for (const w of state.wires) {
      if (w.from.compId === c.id) {
        const nId = w.to.compId;
        if (busOf[nId] !== undefined) connectedBuses.add(busOf[nId]);
      } else if (w.to.compId === c.id) {
        const nId = w.from.compId;
        if (busOf[nId] !== undefined) connectedBuses.add(busOf[nId]);
      }
    }

    const busArr = [...connectedBuses];
    if (busArr.length < 2) continue;

    const fromBus = busArr[0], toBus = busArr[1];
    const p = c.props || {};
    const BASE = PF_CONFIG.baseMVA;
    let branch = { type: c.type, from: fromBus, to: toBus, name: c.name, compId: c.id };

    if (c.type === 'line' || c.type === 'cable') {
      const len  = parseFloat(p.len)  || 1;
      const r1   = parseFloat(p.r1)   || 0.07;
      const x1   = parseFloat(p.x1)   || 0.37;
      const b1   = (parseFloat(p.b1)  || 3.0) * 1e-6;
      const kv   = parseFloat(p.kv)   || 132;
      const zBase = (kv * kv) / BASE;
      const yBase = 1 / zBase;
      branch.r        = (r1 * len) / zBase;
      branch.x        = (x1 * len) / zBase;
      branch.bsh      = (b1 * len) / yBase;
      branch.tap      = 1.0;
      branch.ampacity = parseFloat(p.ampacity) || 900;
      branch.kvRating = kv;

      // Voltage mismatch check between bus kV and cable kV rating
      const kvFrom = buses[fromBus].kv, kvTo = buses[toBus].kv;
      const ratio  = Math.max(kvFrom, kvTo) / Math.max(kv, 0.001);
      if (ratio > 1.15 || ratio < 0.85) {
        warnings.push(
          `Voltage mismatch: ${c.name} rated ${kv} kV connects ` +
          `${buses[fromBus].name} (${kvFrom} kV) ↔ ${buses[toBus].name} (${kvTo} kV). ` +
          `Check component voltage ratings.`
        );
      }

    } else if (c.type === 'transformer2w') {
      const mva  = parseFloat(p.mva)   || 50;
      const hv   = parseFloat(p.hv_kv) || 132;
      const lv   = parseFloat(p.lv_kv) || 11;
      const zPct = parseFloat(p.z_pct) || 12.5;
      const rPct = parseFloat(p.r_pct) || 0.5;
      const tap  = parseFloat(p.tap)   || 1.0;
      branch.r        = rPct  / 100 * (BASE / mva);
      branch.x        = Math.sqrt(Math.max((zPct/100)**2 - (rPct/100)**2, 0)) * (BASE / mva);
      branch.bsh      = 0;
      branch.tap      = tap;
      branch.ampacity = (mva * 1e6) / (Math.sqrt(3) * Math.min(hv, lv) * 1e3);
      branch.kvRating = Math.max(hv, lv);

    } else if (c.type === 'transformer3w') {
      const mva  = parseFloat(p.mva)  || 100;
      const hv   = parseFloat(p.hv_kv)|| 132;
      const zhm  = parseFloat(p.z_hm) || 12;
      const zhl  = parseFloat(p.z_hl) || 14;
      const zml  = parseFloat(p.z_ml) || 8;
      const base = BASE / mva;
      branch.r        = (zhm + zhl - zml) / 200 * base;
      branch.x        = Math.max(0.99 * branch.r, 0.001 * base);
      branch.bsh      = 0;
      branch.tap      = 1.0;
      branch.ampacity = (mva * 1e6) / (Math.sqrt(3) * hv * 1e3);
      branch.kvRating = hv;
    }

    branches.push(branch);
  }

  return { buses, branches, warnings };
}

/* ═══════════════════════════════════════════════════════
   NEWTON-RAPHSON SOLVER
   ═══════════════════════════════════════════════════════ */

function solveNewtonRaphson(buses, branches, BASE) {
  const n        = buses.length;
  const MAX_ITER = PF_CONFIG.maxIter;
  const TOL      = PF_CONFIG.tolerance;

  const V     = buses.map(b => b.vInit || 1.0);
  const theta = buses.map(b => b.angleInit || 0.0);

  const slackIdx = buses.findIndex(b => b.type === 'SLACK');
  const { G, B } = buildYbus(n, branches);

  let converged = false, iter = 0;

  for (iter = 0; iter < MAX_ITER; iter++) {
    const Pcalc = new Float64Array(n);
    const Qcalc = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dθ = theta[i] - theta[j];
        Pcalc[i] += V[i] * V[j] * (G[i][j] * Math.cos(dθ) + B[i][j] * Math.sin(dθ));
        Qcalc[i] += V[i] * V[j] * (G[i][j] * Math.sin(dθ) - B[i][j] * Math.cos(dθ));
      }
    }

    const dP = [], dQ = [];
    for (let i = 0; i < n; i++) {
      if (buses[i].type === 'SLACK') continue;
      dP.push({ i, val: buses[i].pSched - Pcalc[i] });
      if (buses[i].type === 'PQ') dQ.push({ i, val: buses[i].qSched - Qcalc[i] });
    }

    const maxMis = Math.max(...dP.map(x => Math.abs(x.val)), ...dQ.map(x => Math.abs(x.val)), 0);
    if (maxMis < TOL) { converged = true; break; }

    const pvBuses  = buses.filter(b => b.type === 'PV').map(b => b.idx);
    const pqBuses  = buses.filter(b => b.type === 'PQ').map(b => b.idx);
    const allPVPQ  = [...pvBuses, ...pqBuses];
    const vUnknown = pqBuses;
    const nθ = allPVPQ.length, nV = vUnknown.length;
    const Jsize = nθ + nV;
    const Jmat  = Array.from({ length: Jsize }, () => new Float64Array(Jsize));
    const rhs   = new Float64Array(Jsize);

    for (let ri = 0; ri < nθ; ri++) {
      const i = allPVPQ[ri];
      const misP = dP.find(x => x.i === i);
      rhs[ri] = misP ? misP.val : 0;
      for (let ci = 0; ci < nθ; ci++) {
        const j = allPVPQ[ci];
        if (i === j) Jmat[ri][ci] = -Qcalc[i] - B[i][i] * V[i] * V[i];
        else { const dθ = theta[i]-theta[j]; Jmat[ri][ci] = V[i]*V[j]*(G[i][j]*Math.sin(dθ)-B[i][j]*Math.cos(dθ)); }
      }
      for (let ci = 0; ci < nV; ci++) {
        const j = vUnknown[ci];
        if (i === j) Jmat[ri][nθ+ci] = Pcalc[i] + G[i][i]*V[i]*V[i];
        else { const dθ = theta[i]-theta[j]; Jmat[ri][nθ+ci] = V[i]*V[j]*(G[i][j]*Math.cos(dθ)+B[i][j]*Math.sin(dθ)); }
      }
    }
    for (let ri = 0; ri < nV; ri++) {
      const i = vUnknown[ri];
      const misQ = dQ.find(x => x.i === i);
      rhs[nθ+ri] = misQ ? misQ.val : 0;
      for (let ci = 0; ci < nθ; ci++) {
        const j = allPVPQ[ci];
        if (i === j) Jmat[nθ+ri][ci] = Pcalc[i] - G[i][i]*V[i]*V[i];
        else { const dθ = theta[i]-theta[j]; Jmat[nθ+ri][ci] = -V[i]*V[j]*(G[i][j]*Math.cos(dθ)+B[i][j]*Math.sin(dθ)); }
      }
      for (let ci = 0; ci < nV; ci++) {
        const j = vUnknown[ci];
        if (i === j) Jmat[nθ+ri][nθ+ci] = Qcalc[i] - B[i][i]*V[i]*V[i];
        else { const dθ = theta[i]-theta[j]; Jmat[nθ+ri][nθ+ci] = V[i]*V[j]*(G[i][j]*Math.sin(dθ)-B[i][j]*Math.cos(dθ)); }
      }
    }

    const dx = gaussElim(Jmat, rhs, Jsize);
    if (!dx) { converged = false; break; }
    for (let ri = 0; ri < nθ; ri++) theta[allPVPQ[ri]] += dx[ri];
    for (let ri = 0; ri < nV;  ri++) V[vUnknown[ri]] += dx[nθ+ri] * V[vUnknown[ri]];
    for (const i of pvBuses) V[i] = buses[i].vSpec;
    V[slackIdx]     = buses[slackIdx].vSpec;
    theta[slackIdx] = buses[slackIdx].angleInit;
  }

  return _buildResult('Newton-Raphson', converged, iter, V, theta, buses, branches, BASE);
}

/* ═══════════════════════════════════════════════════════
   FAST-DECOUPLED (XB / BX)
   ═══════════════════════════════════════════════════════ */

function solveFastDecoupled(buses, branches, BASE, variant) {
  const n        = buses.length;
  const MAX_ITER = PF_CONFIG.maxIter;
  const TOL      = PF_CONFIG.tolerance;

  const V     = buses.map(b => b.vInit || 1.0);
  const theta = buses.map(b => b.angleInit || 0.0);

  const slackIdx = buses.findIndex(b => b.type === 'SLACK');
  const { G, B } = buildYbus(n, branches);

  const pvBuses  = buses.filter(b => b.type === 'PV').map(b => b.idx);
  const pqBuses  = buses.filter(b => b.type === 'PQ').map(b => b.idx);
  const allPVPQ  = [...pvBuses, ...pqBuses];

  // Build constant B' and B'' matrices (using |B| elements only)
  const nθ = allPVPQ.length;
  const nV = pqBuses.length;

  const Bp = Array.from({ length: nθ }, () => new Float64Array(nθ));
  const Bpp= Array.from({ length: nV  }, () => new Float64Array(nV));

  for (let ri = 0; ri < nθ; ri++) {
    for (let ci = 0; ci < nθ; ci++) {
      Bp[ri][ci] = -B[allPVPQ[ri]][allPVPQ[ci]];
    }
  }
  for (let ri = 0; ri < nV; ri++) {
    for (let ci = 0; ci < nV; ci++) {
      Bpp[ri][ci] = -B[pqBuses[ri]][pqBuses[ci]];
    }
  }

  const BpInv  = invertMatrix(Bp, nθ);
  const BppInv = invertMatrix(Bpp, nV);

  let converged = false, iter = 0;

  for (iter = 0; iter < MAX_ITER; iter++) {
    // P-θ subproblem
    const dP = new Float64Array(nθ);
    let maxMis = 0;
    for (let ri = 0; ri < nθ; ri++) {
      const i = allPVPQ[ri];
      let Pcalc = 0;
      for (let j = 0; j < n; j++) {
        const dθ = theta[i] - theta[j];
        Pcalc += V[i] * V[j] * (G[i][j] * Math.cos(dθ) + B[i][j] * Math.sin(dθ));
      }
      dP[ri] = (buses[i].pSched - Pcalc) / V[i];
      maxMis = Math.max(maxMis, Math.abs(dP[ri]));
    }
    const dTheta = matVec(BpInv, dP, nθ);
    for (let ri = 0; ri < nθ; ri++) theta[allPVPQ[ri]] += dTheta[ri];
    theta[slackIdx] = buses[slackIdx].angleInit;

    // Q-V subproblem
    const dQ = new Float64Array(nV);
    for (let ri = 0; ri < nV; ri++) {
      const i = pqBuses[ri];
      let Qcalc = 0;
      for (let j = 0; j < n; j++) {
        const dθ = theta[i] - theta[j];
        Qcalc += V[i] * V[j] * (G[i][j] * Math.sin(dθ) - B[i][j] * Math.cos(dθ));
      }
      dQ[ri] = (buses[i].qSched - Qcalc) / V[i];
      maxMis = Math.max(maxMis, Math.abs(dQ[ri]));
    }
    const dV = matVec(BppInv, dQ, nV);
    for (let ri = 0; ri < nV; ri++) V[pqBuses[ri]] += dV[ri];
    for (const i of pvBuses) V[i] = buses[i].vSpec;
    V[slackIdx] = buses[slackIdx].vSpec;

    if (maxMis < TOL) { converged = true; break; }
  }

  const label = variant === 'fdbx' ? 'Fast-Decoupled BX' : 'Fast-Decoupled XB';
  return _buildResult(label, converged, iter, V, theta, buses, branches, BASE);
}

/* ═══════════════════════════════════════════════════════
   DC LOAD FLOW
   ═══════════════════════════════════════════════════════ */

function solveDCLoadFlow(buses, branches, BASE) {
  const n = buses.length;
  const slackIdx = buses.findIndex(b => b.type === 'SLACK');

  // DC B-matrix (imaginary part of Ybus)
  const { B } = buildYbus(n, branches);

  // Build reduced B matrix (exclude slack)
  const indices = buses.map((b, i) => i).filter(i => i !== slackIdx);
  const m       = indices.length;
  const Bdc     = Array.from({ length: m }, () => new Float64Array(m));
  const pVec    = new Float64Array(m);

  for (let ri = 0; ri < m; ri++) {
    const i = indices[ri];
    pVec[ri] = buses[i].pSched;
    for (let ci = 0; ci < m; ci++) {
      const j = indices[ci];
      Bdc[ri][ci] = -B[i][j];
    }
  }

  const theta = new Array(n).fill(0);
  const sol   = gaussElim(Bdc, pVec, m);
  if (sol) {
    for (let ri = 0; ri < m; ri++) theta[indices[ri]] = sol[ri];
  }

  // DC assumes flat voltage profile
  const V = buses.map(b => b.vSpec || 1.0);

  return _buildResult('DC Load Flow (linear)', true, 1, V, theta, buses, branches, BASE);
}

/* ═══════════════════════════════════════════════════════
   GAUSS-SEIDEL
   ═══════════════════════════════════════════════════════ */

function solveGaussSeidel(buses, branches, BASE) {
  const n        = buses.length;
  const MAX_ITER = PF_CONFIG.maxIter * 10; // GS needs more iterations
  const TOL      = PF_CONFIG.tolerance;

  const slackIdx = buses.findIndex(b => b.type === 'SLACK');
  const { G, B } = buildYbus(n, branches);

  // Complex voltage stored as real and imaginary parts
  const Vr = buses.map(b => b.vInit || 1.0);
  const Vi = buses.map(() => 0.0);
  Vr[slackIdx] = (buses[slackIdx].vSpec || 1.0) * Math.cos(buses[slackIdx].angleInit || 0);
  Vi[slackIdx] = (buses[slackIdx].vSpec || 1.0) * Math.sin(buses[slackIdx].angleInit || 0);

  let converged = false, iter = 0;

  for (iter = 0; iter < MAX_ITER; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      if (i === slackIdx) continue;
      const bus = buses[i];
      const V2  = Vr[i]**2 + Vi[i]**2 || 1e-12;
      const Psch = bus.pSched;   // already in pu
      let   Qsch = bus.qSched;

      // For PV bus compute Q from current voltages
      if (bus.type === 'PV') {
        let Qcalc = 0;
        for (let j = 0; j < n; j++) {
          const dθ = Math.atan2(Vi[i],Vr[i]) - Math.atan2(Vi[j],Vr[j]);
          const Vj = Math.sqrt(Vr[j]**2+Vi[j]**2);
          Qcalc += Math.sqrt(V2)*Vj*(G[i][j]*Math.sin(dθ)-B[i][j]*Math.cos(dθ));
        }
        Qsch = Math.max(bus.qMin, Math.min(bus.qMax, Qcalc));
      }

      // Injected current conjugate I* = (P - jQ) / V*
      const Ir = (Psch*Vr[i] + Qsch*Vi[i]) / V2;
      const Ii = (Psch*Vi[i] - Qsch*Vr[i]) / V2;

      // Compute new V_i from Gauss-Seidel update:
      // V_i = (1/Y_ii) * (I_i - sum_{j≠i} Y_ij V_j)
      let sumR = Ir, sumI = Ii;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        sumR -= G[i][j]*Vr[j] - B[i][j]*Vi[j];
        sumI -= G[i][j]*Vi[j] + B[i][j]*Vr[j];
      }
      const Y2    = G[i][i]**2 + B[i][i]**2;
      const newVr = (sumR*G[i][i] + sumI*B[i][i]) / Y2;
      const newVi = (sumI*G[i][i] - sumR*B[i][i]) / Y2;

      if (bus.type === 'PV') {
        const mag  = Math.sqrt(newVr**2 + newVi**2) || 1;
        const scl  = bus.vSpec / mag;
        Vr[i] = newVr * scl;
        Vi[i] = newVi * scl;
      } else {
        maxDelta = Math.max(maxDelta, Math.abs(newVr-Vr[i]), Math.abs(newVi-Vi[i]));
        Vr[i] = newVr;
        Vi[i] = newVi;
      }
    }
    if (maxDelta < TOL) { converged = true; break; }
  }

  const V     = buses.map((_, i) => Math.sqrt(Vr[i]**2 + Vi[i]**2));
  const theta = buses.map((_, i) => Math.atan2(Vi[i], Vr[i]));
  return _buildResult('Gauss-Seidel', converged, iter, V, theta, buses, branches, BASE);
}

/* ═══════════════════════════════════════════════════════
   Y-BUS
   ═══════════════════════════════════════════════════════ */

function buildYbus(n, branches) {
  const G = Array.from({ length: n }, () => new Float64Array(n));
  const B = Array.from({ length: n }, () => new Float64Array(n));
  for (const br of branches) {
    const { from: i, to: j, r, x, bsh, tap } = br;
    const a = tap || 1.0;
    const y = complexInv(r, x);
    const g = y.r, b = y.i;
    G[i][i] += g/(a*a); B[i][i] += b/(a*a) + (bsh||0)/2;
    G[j][j] += g;       B[j][j] += b + (bsh||0)/2;
    G[i][j] -= g/a;     B[i][j] -= b/a;
    G[j][i] -= g/a;     B[j][i] -= b/a;
  }
  return { G, B };
}

/* ═══════════════════════════════════════════════════════
   RESULT BUILDER (shared)
   ═══════════════════════════════════════════════════════ */

function _buildResult(methodLabel, converged, iter, V, theta, buses, branches, BASE) {
  const n = buses.length;
  const { G, B } = buildYbus(n, branches);

  const finalP = new Float64Array(n);
  const finalQ = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dθ = theta[i] - theta[j];
      finalP[i] += V[i]*V[j]*(G[i][j]*Math.cos(dθ)+B[i][j]*Math.sin(dθ));
      finalQ[i] += V[i]*V[j]*(G[i][j]*Math.sin(dθ)-B[i][j]*Math.cos(dθ));
    }
  }

  const branchResults = branches.map(br => {
    const i = br.from, j = br.to;
    const y = complexInv(br.r, br.x);
    const dθ = theta[i] - theta[j];
    const a  = br.tap || 1;
    const g  = y.r, b = y.i;
    const Pij  = (V[i]*V[i])/(a*a)*g   - V[i]*V[j]/a*(g*Math.cos(dθ)+b*Math.sin(dθ));
    const Qij  = -(V[i]*V[i])/(a*a)*(b+(br.bsh||0)/2) - V[i]*V[j]/a*(g*Math.sin(dθ)-b*Math.cos(dθ));
    const Pji  = V[j]*V[j]*g           - V[i]*V[j]/a*(g*Math.cos(dθ)-b*Math.sin(dθ));
    const Qji  = -V[j]*V[j]*(b+(br.bsh||0)/2) + V[i]*V[j]/a*(g*Math.sin(dθ)+b*Math.cos(dθ));
    const Sloss= (Pij+Pji)*BASE;
    const kv   = br.kvRating || buses[i].kv;
    const Sij  = Math.sqrt(Pij**2+Qij**2)*BASE;
    const Iact = kv > 0 ? Sij*1e6/(Math.sqrt(3)*kv*1e3) : 0;
    const Irat = br.ampacity || Infinity;
    const load = Irat > 0 ? (Iact/Irat)*100 : 0;
    return {
      name:        br.name,
      type:        br.type,
      compId:      br.compId,
      fromBus:     buses[i].name,
      toBus:       buses[j].name,
      P_MW:        (Pij*BASE).toFixed(3),
      Q_MVAR:      (Qij*BASE).toFixed(3),
      S_MVA:       Sij.toFixed(3),
      loss_MW:     Sloss.toFixed(4),
      I_A:         Iact.toFixed(1),
      I_rated_A:   isFinite(Irat) ? Irat.toFixed(0) : '∞',
      loading_pct: load.toFixed(1),
    };
  });

  return {
    method: methodLabel,
    converged,
    iterations: iter,
    buses: buses.map((b, i) => ({
      name:      b.name,
      type:      b.type,
      kv:        b.kv,
      v_pu:      V[i].toFixed(5),
      v_kv:      (V[i]*b.kv).toFixed(3),
      angle_deg: (theta[i]*180/Math.PI).toFixed(3),
      P_MW:      (finalP[i]*BASE).toFixed(3),
      Q_MVAR:    (finalQ[i]*BASE).toFixed(3),
      v_raw:     V[i],
      nodeGroup: b.nodeGroup,
    })),
    branches: branchResults,
  };
}

/* ═══════════════════════════════════════════════════════
   MATH UTILITIES
   ═══════════════════════════════════════════════════════ */

function complexInv(r, x) {
  const d = r*r + x*x;
  if (d < 1e-20) return { r: 0, i: 0 };
  return { r: r/d, i: -x/d };
}

function gaussElim(A, b, n) {
  const M = A.map((row, i) => [...row, b instanceof Float64Array ? b[i] : b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col, maxVal = Math.abs(M[col][col]);
    for (let row = col+1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) { maxVal = Math.abs(M[row][col]); maxRow = row; }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-15) return null;
    for (let row = col+1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let c = col; c <= n; c++) M[row][c] -= f * M[col][c];
    }
  }
  const x = new Float64Array(n);
  for (let i = n-1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i+1; j < n; j++) x[i] -= M[i][j]*x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function invertMatrix(A, n) {
  if (n === 0) return [];
  // Augmented [A|I]
  const M = A.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(j === i ? 1 : 0);
    return r;
  });
  for (let col = 0; col < n; col++) {
    let maxRow = col, maxVal = Math.abs(M[col][col]);
    for (let row = col+1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) { maxVal = Math.abs(M[row][col]); maxRow = row; }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-15) {
      // Near-singular: return identity as fallback
      return Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
    }
    const pivot = M[col][col];
    for (let c = 0; c < 2*n; c++) M[col][c] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      for (let c = 0; c < 2*n; c++) M[row][c] -= f * M[col][c];
    }
  }
  return M.map(row => {
    const r = new Float64Array(n);
    for (let j = 0; j < n; j++) r[j] = row[n+j];
    return r;
  });
}

function matVec(M, v, n) {
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) result[i] += M[i][j] * v[j];
  return result;
}

/* ═══════════════════════════════════════════════════════
   RESULTS DISPLAY
   ═══════════════════════════════════════════════════════ */

function showPFResults(result, buses, branches) {
  // Show in the study modal body
  const resultsDiv = document.getElementById('study-pf-results');
  const statusDiv  = document.getElementById('pf-status');

  const status = result.converged
    ? `<span class="pf-converged">✓ Converged (${result.method}) — ${result.iterations} iteration${result.iterations!==1?'s':''}</span>`
    : `<span class="pf-diverged">✗ Did NOT converge after ${result.iterations} iterations — check network parameters</span>`;

  if (statusDiv) statusDiv.innerHTML = status;

  // Voltage mismatch warnings
  const warnHtml = (result.warnings || []).length > 0
    ? `<div class="pf-warnings">${result.warnings.map(w =>
        `<div class="pf-warn-item">⚠ ${w}</div>`).join('')}</div>` : '';

  // Bus table
  const busRows = result.buses.map(b => {
    const vPu  = parseFloat(b.v_pu);
    const vCls = vPu < 0.90 ? 'v-low' : vPu > 1.10 ? 'v-high' : vPu < 0.95 || vPu > 1.05 ? 'v-warn' : 'v-ok';
    return `<tr>
      <td>${b.name}</td><td>${b.type}</td><td>${b.kv}</td>
      <td class="${vCls}">${b.v_pu}</td><td class="${vCls}">${b.v_kv}</td>
      <td>${b.angle_deg}</td><td>${b.P_MW}</td><td>${b.Q_MVAR}</td>
    </tr>`;
  }).join('');

  // Branch table
  const branchRows = result.branches.map(br => {
    const load = parseFloat(br.loading_pct);
    const lCls = load > 100 ? 'v-high' : load > 80 ? 'v-warn' : 'v-ok';
    return `<tr>
      <td>${br.name}</td><td>${br.fromBus}</td><td>${br.toBus}</td>
      <td>${br.P_MW}</td><td>${br.Q_MVAR}</td><td>${br.S_MVA}</td>
      <td>${br.I_A}</td><td class="${lCls}">${br.loading_pct}%</td><td>${br.loss_MW}</td>
    </tr>`;
  }).join('');

  const html = `
    ${warnHtml}
    <div class="pf-section">
      <div class="pf-section-title">Bus Voltages &amp; Power (Base: ${PF_CONFIG.baseMVA} MVA)</div>
      <div class="pf-table-wrap">
        <table class="pf-table">
          <thead><tr><th>Bus</th><th>Type</th><th>kV nom</th><th>V (pu)</th><th>V (kV)</th><th>θ (°)</th><th>P (MW)</th><th>Q (MVAR)</th></tr></thead>
          <tbody>${busRows}</tbody>
        </table>
      </div>
    </div>
    <div class="pf-section">
      <div class="pf-section-title">Branch Power Flows</div>
      <div class="pf-table-wrap">
        <table class="pf-table">
          <thead><tr><th>Branch</th><th>From</th><th>To</th><th>P (MW)</th><th>Q (MVAR)</th><th>S (MVA)</th><th>I (A)</th><th>Loading %</th><th>Loss (MW)</th></tr></thead>
          <tbody>${branchRows || '<tr><td colspan="9" style="text-align:center;color:var(--text-dim)">No branch elements found</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

  if (resultsDiv) {
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = '';
  }

  // Also show in legacy pf-modal if present
  const modal = document.getElementById('pf-modal');
  if (modal) {
    const legacyStatus = document.getElementById('pf-status');
    if (legacyStatus) legacyStatus.innerHTML = status;
    const pfBusBody = document.getElementById('pf-bus-body');
    if (pfBusBody) pfBusBody.innerHTML = busRows;
    const pfBranchBody = document.getElementById('pf-branch-body');
    if (pfBranchBody) pfBranchBody.innerHTML = branchRows || '<tr><td colspan="9">No branches</td></tr>';
  }
}

function showPFError(msg) {
  const resultsDiv = document.getElementById('study-pf-results');
  if (resultsDiv) {
    resultsDiv.innerHTML = `<div class="pf-error-box">✗ ${msg}</div>`;
    resultsDiv.style.display = '';
  }
  const statusDiv = document.getElementById('pf-status');
  if (statusDiv) statusDiv.innerHTML = `<span class="pf-diverged">${msg}</span>`;
}

/* ═══════════════════════════════════════════════════════
   SLD VOLTAGE & FLOW OVERLAY
   ═══════════════════════════════════════════════════════ */

function applyVoltageOverlay(busResults, branchResults, overlayMode) {
  // Clear previous overlay badges
  document.querySelectorAll('.pf-voltage-label, .pf-branch-label, .pf-bus-badge, .pf-flow-badge').forEach(el => el.remove());

  const overlayLayer = document.getElementById('pf-overlay-layer');
  if (!overlayLayer) return;
  overlayLayer.innerHTML = '';

  // Helper: get component by id from state
  function getComp(id) { return state.components.find(c => c.id === id); }

  // Helper: get bounding box (canvas coords) of a component
  function compBBox(mc) {
    const def = (typeof SLD_COMP !== 'undefined') ? SLD_COMP[mc.type] : null;
    const w = (def ? def.w : 40);
    const h = (def ? def.h : 40);
    return { x: mc.x, y: mc.y, w, h };
  }

  // Helper: get world position of a port
  function getPortPos(compId, portId) {
    const mc = getComp(compId);
    if (!mc) return null;
    const def = (typeof SLD_COMP !== 'undefined') ? SLD_COMP[mc.type] : null;
    if (!def) return { x: mc.x, y: mc.y };
    const port = def.ports.find(p => p.id === portId);
    if (!port) return { x: mc.x, y: mc.y };
    // Rotate port positions for rotated components
    const angle = (mc.rotation || 0) * Math.PI / 180;
    const cx = def.w / 2, cy = def.h / 2;
    const px = port.x - cx, py = port.y - cy;
    const rx = px * Math.cos(angle) - py * Math.sin(angle) + cx;
    const ry = px * Math.sin(angle) + py * Math.cos(angle) + cy;
    return { x: mc.x + rx, y: mc.y + ry };
  }

  // ── Bus voltage badges ──
  for (const br of busResults) {
    const vPu = parseFloat(br.v_pu);
    const vClass = vPu < 0.90 ? 'v-low' : vPu > 1.10 ? 'v-high' : vPu < 0.95 || vPu > 1.05 ? 'v-warn' : 'v-ok';

    // Find primary component for this bus
    const compsToLabel = state.components.filter(c =>
      br.nodeGroup && br.nodeGroup.includes(c.id) &&
      (c.type === 'bus' || c.type === 'utility' || c.type === 'generator')
    );
    if (compsToLabel.length === 0) {
      const mc = state.components.find(c => c.name === br.name);
      if (mc) compsToLabel.push(mc);
    }

    compsToLabel.forEach(mc => {
      const bbox = compBBox(mc);
      const badge = document.createElement('div');
      badge.className = `pf-bus-badge ${vClass}`;
      // Position to the right of the component with a small gap
      badge.style.left  = (bbox.x + bbox.w + 8) + 'px';
      badge.style.top   = (bbox.y + bbox.h / 2 - 20) + 'px';
      badge.innerHTML =
        `<span style="opacity:0.7;font-size:9px;">${br.name}</span><br>` +
        `<b>${br.v_pu} pu</b>  ${br.v_kv} kV<br>` +
        `<span style="font-weight:normal;font-size:9px;">θ ${br.angle_deg}°  P ${br.P_MW} MW  Q ${br.Q_MVAR} Mvar</span>`;
      overlayLayer.appendChild(badge);
    });
  }

  // ── Branch flow badges ──
  if (overlayMode !== 'both') return;

  for (const br of branchResults) {
    if (!br.compId) continue;
    const mc = getComp(br.compId);
    if (!mc) continue;

    // Find the wire connected to this branch component (use first wire)
    const wire = state.wires.find(w => w.from.compId === br.compId || w.to.compId === br.compId);

    let midX, midY;
    if (wire) {
      // Compute midpoint of the wire using port positions
      const fromPos = getPortPos(wire.from.compId, wire.from.portId);
      const toPos   = getPortPos(wire.to.compId, wire.to.portId);
      if (fromPos && toPos) {
        midX = (fromPos.x + toPos.x) / 2;
        midY = (fromPos.y + toPos.y) / 2;
      }
    }
    if (midX === undefined) {
      // Fall back to component center
      const bbox = compBBox(mc);
      midX = mc.x + bbox.w / 2;
      midY = mc.y + bbox.h / 2;
    }

    const load    = parseFloat(br.loading_pct);
    const loadCls = load > 100 ? 'load-high' : load > 80 ? 'load-warn' : '';
    // Arrow direction: positive P flows from → to, negative flows ← from
    const pVal = parseFloat(br.P_MW);
    const arrowChar = pVal >= 0 ? '→' : '←';

    const badge = document.createElement('div');
    badge.className = `pf-flow-badge ${loadCls}`;
    badge.style.left = (midX + 6) + 'px';
    badge.style.top  = (midY - 14) + 'px';
    badge.innerHTML =
      `<span class="pf-flow-arrow">${arrowChar}</span>` +
      `<span>${Math.abs(pVal).toFixed(2)} MW · ${br.Q_MVAR} Mvar · ${br.I_A} A · <b>${br.loading_pct}%</b></span>`;
    overlayLayer.appendChild(badge);
  }
}
