'use strict';

/**
 * pf-engine.js — Power Flow Analysis Engine (Newton-Raphson)
 *
 * Extracts network topology from the KIT SLD state and solves the
 * AC steady-state load flow equations using the Newton-Raphson method.
 *
 * Bus types:
 *   SLACK  (ref)  : utility/grid connection. V magnitude and angle are fixed.
 *   PV            : generator buses. P and V magnitude are specified.
 *   PQ            : all other buses. P and Q are specified.
 *
 * Per-unit system: Sb = 100 MVA. Vb = nominal bus voltage.
 *
 * Terminology:
 *   Ybus          : Bus admittance matrix (complex, n×n)
 *   theta (θ)     : Bus voltage angle vector (radians)
 *   vmag  (V)     : Bus voltage magnitude vector (per-unit)
 *   P, Q          : Scheduled real and reactive power (per-unit)
 *   ΔP, ΔQ        : Mismatch vectors
 *   J             : Jacobian matrix [H N; J L]
 */

const PF_BASE_MVA = 100; // System MVA base

/* ═══════════════════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════════════════ */

function runPowerFlow() {
  try {
    const { buses, branches } = buildNetwork();
    if (buses.length === 0) {
      showPFError('No buses found. Add Bus, Generator, or Utility components.');
      return;
    }
    const slackBuses = buses.filter(b => b.type === 'SLACK');
    if (slackBuses.length === 0) {
      showPFError('No slack bus found. Add a Utility (grid) component and connect it to the network.');
      return;
    }
    if (buses.length < 2) {
      showPFError('Need at least 2 buses. Add more components and connect them.');
      return;
    }

    const result = solveNewtonRaphson(buses, branches);
    showPFResults(result, buses, branches);

    // Colour-code SLD components by voltage
    applyVoltageOverlay(result.buses);

  } catch (err) {
    showPFError('Power flow error: ' + err.message);
    console.error(err);
  }
}

/* ═══════════════════════════════════════════════════════
   NETWORK EXTRACTION
   ═══════════════════════════════════════════════════════ */

/**
 * Walk the SLD state and build bus/branch lists for the solver.
 */
function buildNetwork() {
  const buses = [];
  const branches = [];

  // ── Step 1: identify bus nodes ──────────────────────
  // Every 'bus', 'utility', 'generator', 'load', 'motor' component is a potential bus node.
  // We use connectivity to merge nodes that are directly connected without a branch element.

  const nodeComps = new Set(['bus', 'utility', 'generator', 'load', 'motor']);
  const branchComps = new Set(['line', 'cable', 'transformer2w', 'transformer3w']);
  const passComps = new Set(['cb', 'disconnector', 'fuse', 'ct', 'vt',
                              'relay_oc', 'relay_diff', 'relay_dist', 'relay_ef']);

  // Build a simple adjacency map: compId → [connected compIds]
  const adj = {};
  for (const c of state.components) adj[c.id] = new Set();

  for (const w of state.wires) {
    // Only propagate through pass-through elements for node merging
    const fromComp = getComp(w.from.compId);
    const toComp   = getComp(w.to.compId);
    if (!fromComp || !toComp) continue;
    adj[w.from.compId].add(w.to.compId);
    adj[w.to.compId].add(w.from.compId);
  }

  // BFS to find connected node groups (merge through pass-through elements)
  const busOf = {}; // compId → busIndex
  let busIdx = 0;

  for (const c of state.components) {
    if (!(nodeComps.has(c.type) || passComps.has(c.type))) continue;
    if (busOf[c.id] !== undefined) continue;

    // BFS flood-fill through pass-through elements to find this bus node
    const queue = [c.id];
    const visited = new Set([c.id]);
    const nodeGroup = [];

    while (queue.length) {
      const curr = queue.shift();
      const comp = getComp(curr);
      if (!comp) continue;

      // Add to group if it's a meaningful node or pass-through
      nodeGroup.push(curr);
      busOf[curr] = busIdx;

      for (const nId of adj[curr]) {
        if (visited.has(nId)) continue;
        const nComp = getComp(nId);
        if (!nComp) continue;
        // Only propagate through pass-through elements (CB, DS, CT, VT, relays)
        // Stop propagation at branch elements (lines, cables, transformers)
        if (passComps.has(nComp.type) || nodeComps.has(nComp.type)) {
          visited.add(nId);
          queue.push(nId);
        }
      }
    }

    // Determine bus type from the most significant component in this group
    let busType = 'PQ';
    let kv = 11;
    let vInit = 1.0;
    let angleInit = 0;
    let pSched = 0;  // MW
    let qSched = 0;  // MVAR
    let pGen = 0;
    let vSpec = 1.0;
    let qMax = 999;
    let qMin = -999;
    let busName = null;

    for (const nId of nodeGroup) {
      const nc = getComp(nId);
      if (!nc) continue;
      const p = nc.props || {};

      if (nc.type === 'utility') {
        busType = 'SLACK';
        kv = parseFloat(p.kv) || 132;
        vSpec = parseFloat(p.v_pu) || 1.0;
        angleInit = (parseFloat(p.angle) || 0) * Math.PI / 180;
        busName = nc.name;
      } else if (nc.type === 'generator' && busType !== 'SLACK') {
        busType = 'PV';
        kv = parseFloat(p.kv) || 11;
        pGen = parseFloat(p.pg) || 80;
        vSpec = parseFloat(p.vg) || 1.0;
        qMax = parseFloat(p.qmax) || 9999;
        qMin = parseFloat(p.qmin) || -9999;
        busName = busName || nc.name;
      } else if (nc.type === 'bus') {
        kv = kv || (parseFloat(p.kv) || 11);
        if (p.bus_type === 'Slack') busType = 'SLACK';
        else if (p.bus_type === 'PV' && busType !== 'SLACK') busType = 'PV';
        busName = busName || nc.name;
        vInit = parseFloat(p.v_init) || 1.0;
      } else if (nc.type === 'load') {
        pSched += parseFloat(p.mw) || 0;
        qSched += parseFloat(p.mvar) || 0;
        kv = kv || (parseFloat(p.kv) || 0.4);
        busName = busName || nc.name;
      } else if (nc.type === 'motor') {
        const kw = parseFloat(p.kw) || 0;
        const eff = (parseFloat(p.eff) || 95) / 100;
        const pf = parseFloat(p.pf) || 0.87;
        const mw = kw / 1000 / eff;
        pSched += mw;
        qSched += mw * Math.tan(Math.acos(pf));
        kv = kv || (parseFloat(p.kv) || 0.4);
        busName = busName || nc.name;
      }
    }

    // Net scheduled injection (generation - load, per-unit)
    const pNet = (pGen - pSched) / PF_BASE_MVA;
    const qNet = (-qSched) / PF_BASE_MVA;  // loads consume Q

    buses.push({
      idx: busIdx,
      id: busIdx,
      name: busName || ('Bus ' + (busIdx + 1)),
      type: busType,
      kv,
      vInit: busType === 'SLACK' ? vSpec : (vInit || 1.0),
      vSpec: vSpec,
      angleInit,
      pSched: pNet,
      qSched: qNet,
      qMax: qMax / PF_BASE_MVA,
      qMin: qMin / PF_BASE_MVA,
      nodeGroup,
    });
    busIdx++;
  }

  // ── Step 2: identify branch elements ─────────────────
  for (const c of state.components) {
    if (!branchComps.has(c.type)) continue;

    // Find from/to buses via wires connected to this branch component
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
    if (busArr.length < 2) continue; // not connected to 2 buses

    const fromBus = busArr[0];
    const toBus   = busArr[1];
    const p = c.props || {};

    let branch = { type: c.type, from: fromBus, to: toBus, name: c.name };

    if (c.type === 'line' || c.type === 'cable') {
      const len = parseFloat(p.len) || 1;
      const r1  = parseFloat(p.r1)  || 0.07;
      const x1  = parseFloat(p.x1)  || 0.37;
      const b1  = (parseFloat(p.b1)  || 3.0) * 1e-6; // μS/km → S/km
      const kv  = parseFloat(p.kv)  || 132;
      const zBase = (kv * kv) / PF_BASE_MVA;
      const yBase = 1 / zBase;

      branch.r  = (r1 * len) / zBase;
      branch.x  = (x1 * len) / zBase;
      branch.bsh = (b1 * len) / yBase; // total shunt susceptance (half each end)
      branch.tap = 1.0;
      branch.ampacity = parseFloat(p.ampacity) || 900;
      branch.kvRating = kv;

    } else if (c.type === 'transformer2w') {
      const mva  = parseFloat(p.mva)   || 50;
      const hv   = parseFloat(p.hv_kv) || 132;
      const lv   = parseFloat(p.lv_kv) || 11;
      const zPct = parseFloat(p.z_pct) || 12.5;
      const rPct = parseFloat(p.r_pct) || 0.5;
      const tap  = parseFloat(p.tap)   || 1.0;

      branch.r   = rPct  / 100 * (PF_BASE_MVA / mva);
      branch.x   = Math.sqrt((zPct/100)**2 - (rPct/100)**2) * (PF_BASE_MVA / mva);
      branch.bsh = 0;
      branch.tap = tap;
      branch.ampacity = (mva * 1e6) / (Math.sqrt(3) * lv * 1e3);
      branch.kvRating = Math.max(hv, lv);

    } else if (c.type === 'transformer3w') {
      // Convert 3-winding to 3 two-port branches via star equivalent
      // ZH = (ZHM + ZHL - ZML)/2, ZM = (ZHM + ZML - ZHL)/2, ZL = (ZHL + ZML - ZHM)/2
      const mva  = parseFloat(p.mva)   || 100;
      const hv   = parseFloat(p.hv_kv) || 132;
      const zhm  = parseFloat(p.z_hm)  || 12;
      const zhl  = parseFloat(p.z_hl)  || 14;
      const zml  = parseFloat(p.z_ml)  || 8;
      const base = PF_BASE_MVA / mva;
      branch.r = (zhm + zhl - zml) / 200 * base; // ZH star arm
      branch.x = 0.99 * branch.r;
      branch.bsh = 0;
      branch.tap = 1.0;
      branch.ampacity = (mva * 1e6) / (Math.sqrt(3) * hv * 1e3);
      branch.kvRating = hv;
    }

    branches.push(branch);
  }

  return { buses, branches };
}

/* ═══════════════════════════════════════════════════════
   NEWTON-RAPHSON SOLVER
   ═══════════════════════════════════════════════════════ */

function solveNewtonRaphson(buses, branches) {
  const n = buses.length;
  const MAX_ITER = 50;
  const TOL = 1e-6;

  // Initialise voltage vector
  const V     = buses.map(b => b.vInit || 1.0);
  const theta = buses.map(b => b.angleInit || 0.0);

  // Slack bus index
  const slackIdx = buses.findIndex(b => b.type === 'SLACK');

  // Build Y-bus
  const { G, B } = buildYbus(n, branches);

  let converged = false;
  let iter = 0;

  for (iter = 0; iter < MAX_ITER; iter++) {
    // ── Compute power injections ───────────────────────
    const Pcalc = new Float64Array(n);
    const Qcalc = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dθ = theta[i] - theta[j];
        Pcalc[i] += V[i] * V[j] * (G[i][j] * Math.cos(dθ) + B[i][j] * Math.sin(dθ));
        Qcalc[i] += V[i] * V[j] * (G[i][j] * Math.sin(dθ) - B[i][j] * Math.cos(dθ));
      }
    }

    // ── Compute mismatches ────────────────────────────
    const dP = [];
    const dQ = [];
    for (let i = 0; i < n; i++) {
      if (buses[i].type === 'SLACK') continue;
      dP.push({ i, val: buses[i].pSched - Pcalc[i] });
      if (buses[i].type === 'PQ') {
        dQ.push({ i, val: buses[i].qSched - Qcalc[i] });
      }
    }

    const maxMis = Math.max(
      ...dP.map(x => Math.abs(x.val)),
      ...dQ.map(x => Math.abs(x.val)),
      0
    );

    if (maxMis < TOL) { converged = true; break; }

    // ── Build Jacobian J = [H N; J L] ────────────────
    // H: dP/dθ, N: dP/dV·V, J: dQ/dθ, L: dQ/dV·V
    const pqBuses = buses.filter(b => b.type === 'PQ').map(b => b.idx);
    const pvBuses = buses.filter(b => b.type === 'PV').map(b => b.idx);
    const allPVPQ = [...pvBuses, ...pqBuses]; // θ unknowns (n-1 unknowns)
    const vUnknown = pqBuses; // V unknowns (PQ only)

    const nθ = allPVPQ.length;
    const nV = vUnknown.length;
    const Jsize = nθ + nV;

    // Build full Jacobian as flat array
    const Jmat = Array.from({ length: Jsize }, () => new Float64Array(Jsize));
    const rhs  = new Float64Array(Jsize);

    // Populate H submatrix (dP/dθ)
    for (let ri = 0; ri < nθ; ri++) {
      const i = allPVPQ[ri];
      // RHS: ΔP
      const misP = dP.find(x => x.i === i);
      rhs[ri] = misP ? misP.val : 0;

      for (let ci = 0; ci < nθ; ci++) {
        const j = allPVPQ[ci];
        if (i === j) {
          Jmat[ri][ci] = -Qcalc[i] - B[i][i] * V[i] * V[i];
        } else {
          const dθ = theta[i] - theta[j];
          Jmat[ri][ci] = V[i] * V[j] * (G[i][j] * Math.sin(dθ) - B[i][j] * Math.cos(dθ));
        }
      }

      // N submatrix (dP/d|V|·|V|)
      for (let ci = 0; ci < nV; ci++) {
        const j = vUnknown[ci];
        if (i === j) {
          Jmat[ri][nθ + ci] = Pcalc[i] + G[i][i] * V[i] * V[i];
        } else {
          const dθ = theta[i] - theta[j];
          Jmat[ri][nθ + ci] = V[i] * V[j] * (G[i][j] * Math.cos(dθ) + B[i][j] * Math.sin(dθ));
        }
      }
    }

    // Populate J submatrix (dQ/dθ) and L submatrix (dQ/d|V|·|V|)
    for (let ri = 0; ri < nV; ri++) {
      const i = vUnknown[ri];
      const misQ = dQ.find(x => x.i === i);
      rhs[nθ + ri] = misQ ? misQ.val : 0;

      for (let ci = 0; ci < nθ; ci++) {
        const j = allPVPQ[ci];
        if (i === j) {
          Jmat[nθ + ri][ci] = Pcalc[i] - G[i][i] * V[i] * V[i];
        } else {
          const dθ = theta[i] - theta[j];
          Jmat[nθ + ri][ci] = -V[i] * V[j] * (G[i][j] * Math.cos(dθ) + B[i][j] * Math.sin(dθ));
        }
      }

      for (let ci = 0; ci < nV; ci++) {
        const j = vUnknown[ci];
        if (i === j) {
          Jmat[nθ + ri][nθ + ci] = Qcalc[i] - B[i][i] * V[i] * V[i];
        } else {
          const dθ = theta[i] - theta[j];
          Jmat[nθ + ri][nθ + ci] = V[i] * V[j] * (G[i][j] * Math.sin(dθ) - B[i][j] * Math.cos(dθ));
        }
      }
    }

    // Solve Jmat · Δx = rhs using Gaussian elimination with partial pivoting
    const dx = gaussElim(Jmat, rhs, Jsize);
    if (!dx) { converged = false; break; }

    // Update θ and V
    for (let ri = 0; ri < nθ; ri++) {
      theta[allPVPQ[ri]] += dx[ri];
    }
    for (let ri = 0; ri < nV; ri++) {
      V[vUnknown[ri]] += dx[nθ + ri] * V[vUnknown[ri]];
    }

    // Enforce PV bus voltage magnitude
    for (const i of pvBuses) {
      V[i] = buses[i].vSpec;
    }

    // Enforce slack bus
    V[slackIdx] = buses[slackIdx].vSpec;
    theta[slackIdx] = buses[slackIdx].angleInit;
  }

  // ── Final power calculation ────────────────────────
  const finalP = new Float64Array(n);
  const finalQ = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dθ = theta[i] - theta[j];
      finalP[i] += V[i] * V[j] * (G[i][j] * Math.cos(dθ) + B[i][j] * Math.sin(dθ));
      finalQ[i] += V[i] * V[j] * (G[i][j] * Math.sin(dθ) - B[i][j] * Math.cos(dθ));
    }
  }

  // ── Branch flows ──────────────────────────────────
  const branchResults = branches.map(br => {
    const i = br.from, j = br.to;
    const y = complexInv(br.r, br.x);
    const dθ = theta[i] - theta[j];
    const a = br.tap || 1;
    // P_ij = V_i²/a² * g - V_i*V_j/a * (g*cos(dθ) + b*sin(dθ))
    const g = y.r, b = y.i;
    const Pij = (V[i]*V[i])/(a*a)*g - V[i]*V[j]/a*(g*Math.cos(dθ) + b*Math.sin(dθ));
    const Qij = -(V[i]*V[i])/(a*a)*(b + br.bsh/2) - V[i]*V[j]/a*(g*Math.sin(dθ) - b*Math.cos(dθ));
    const Pji = V[j]*V[j]*g - V[i]*V[j]/a*(g*Math.cos(dθ) - b*Math.sin(dθ));
    const Qji = -V[j]*V[j]*(b + br.bsh/2) + V[i]*V[j]/a*(g*Math.sin(dθ) + b*Math.cos(dθ));
    const Sloss = (Pij + Pji) * PF_BASE_MVA;
    const kvRating = br.kvRating || buses[i].kv;
    const Irated = br.ampacity || Infinity;
    const Sij = Math.sqrt(Pij*Pij + Qij*Qij) * PF_BASE_MVA;
    const Iact = Sij * 1e6 / (Math.sqrt(3) * kvRating * 1e3);
    const loading = Irated > 0 ? (Iact / Irated) * 100 : 0;

    return {
      name: br.name,
      type: br.type,
      fromBus: buses[i].name,
      toBus: buses[j].name,
      P_MW: (Pij * PF_BASE_MVA).toFixed(3),
      Q_MVAR: (Qij * PF_BASE_MVA).toFixed(3),
      S_MVA: Sij.toFixed(3),
      loss_MW: Sloss.toFixed(4),
      I_A: Iact.toFixed(1),
      I_rated_A: Irated.toFixed(0),
      loading_pct: loading.toFixed(1),
    };
  });

  return {
    converged,
    iterations: iter,
    buses: buses.map((b, i) => ({
      name: b.name,
      type: b.type,
      kv: b.kv,
      v_pu: V[i].toFixed(5),
      v_kv: (V[i] * b.kv).toFixed(3),
      angle_deg: (theta[i] * 180 / Math.PI).toFixed(3),
      P_MW: (finalP[i] * PF_BASE_MVA).toFixed(3),
      Q_MVAR: (finalQ[i] * PF_BASE_MVA).toFixed(3),
      v_raw: V[i],
    })),
    branches: branchResults,
  };
}

/* ═══════════════════════════════════════════════════════
   Y-BUS CONSTRUCTION
   ═══════════════════════════════════════════════════════ */

function buildYbus(n, branches) {
  const G = Array.from({ length: n }, () => new Float64Array(n));
  const B = Array.from({ length: n }, () => new Float64Array(n));

  for (const br of branches) {
    const { from: i, to: j, r, x, bsh, tap } = br;
    const a = tap || 1.0;
    const y = complexInv(r, x);
    const g = y.r, b = y.i;

    // Standard π-model with tap:
    G[i][i] += g / (a * a);
    B[i][i] += b / (a * a) + bsh / 2;
    G[j][j] += g;
    B[j][j] += b + bsh / 2;
    G[i][j] -= g / a;
    B[i][j] -= b / a;
    G[j][i] -= g / a;
    B[j][i] -= b / a;
  }
  return { G, B };
}

/* ═══════════════════════════════════════════════════════
   MATH UTILITIES
   ═══════════════════════════════════════════════════════ */

function complexInv(r, x) {
  const denom = r * r + x * x;
  if (denom < 1e-20) return { r: 0, i: 0 };
  return { r: r / denom, i: -x / denom };
}

function gaussElim(A, b, n) {
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-15) return null; // singular

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let c = col; c <= n; c++) {
        M[row][c] -= factor * M[col][c];
      }
    }
  }

  // Back substitution
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }
  return x;
}

/* ═══════════════════════════════════════════════════════
   RESULTS DISPLAY
   ═══════════════════════════════════════════════════════ */

function showPFResults(result, buses, branches) {
  const modal = document.getElementById('pf-modal');
  if (!modal) return;

  const status = result.converged
    ? `<span class="pf-converged">Converged in ${result.iterations} iterations</span>`
    : `<span class="pf-diverged">Did NOT converge after ${result.iterations} iterations — check parameters</span>`;

  // Bus table
  const busRows = result.buses.map(b => {
    const vPu = parseFloat(b.v_pu);
    const vClass = vPu < 0.90 ? 'v-low' : vPu > 1.10 ? 'v-high' : vPu < 0.95 || vPu > 1.05 ? 'v-warn' : 'v-ok';
    return `<tr>
      <td>${b.name}</td>
      <td>${b.type}</td>
      <td class="${vClass}">${b.v_pu}</td>
      <td class="${vClass}">${b.v_kv}</td>
      <td>${b.angle_deg}</td>
      <td>${b.P_MW}</td>
      <td>${b.Q_MVAR}</td>
    </tr>`;
  }).join('');

  // Branch table
  const branchRows = result.branches.map(br => {
    const load = parseFloat(br.loading_pct);
    const lClass = load > 100 ? 'v-high' : load > 80 ? 'v-warn' : 'v-ok';
    return `<tr>
      <td>${br.name}</td>
      <td>${br.fromBus}</td>
      <td>${br.toBus}</td>
      <td>${br.P_MW}</td>
      <td>${br.Q_MVAR}</td>
      <td>${br.S_MVA}</td>
      <td>${br.I_A}</td>
      <td class="${lClass}">${br.loading_pct}%</td>
    </tr>`;
  }).join('');

  document.getElementById('pf-status').innerHTML = status;
  document.getElementById('pf-bus-body').innerHTML = busRows;
  document.getElementById('pf-branch-body').innerHTML = branchRows || '<tr><td colspan="8">No branch elements found</td></tr>';

  modal.style.display = 'flex';
}

function showPFError(msg) {
  const modal = document.getElementById('pf-modal');
  if (!modal) { alert(msg); return; }
  document.getElementById('pf-status').innerHTML = `<span class="pf-diverged">${msg}</span>`;
  document.getElementById('pf-bus-body').innerHTML = '';
  document.getElementById('pf-branch-body').innerHTML = '';
  modal.style.display = 'flex';
}

/* ═══════════════════════════════════════════════════════
   VISUAL VOLTAGE OVERLAY on SLD
   ═══════════════════════════════════════════════════════ */

function applyVoltageOverlay(busResults) {
  // Remove old overlays
  document.querySelectorAll('.pf-voltage-label').forEach(el => el.remove());

  for (const br of busResults) {
    const vPu = parseFloat(br.v_pu);
    const color = vPu < 0.90 ? '#ff4444' : vPu > 1.10 ? '#ff8800' : vPu < 0.95 || vPu > 1.05 ? '#ffd700' : '#00e5a0';

    // Find matching canvas component
    const matchComp = state.components.find(c => c.name === br.name);
    if (!matchComp) continue;

    const el = document.querySelector(`[data-id="${matchComp.id}"]`);
    if (!el) continue;

    const overlay = document.createElement('div');
    overlay.className = 'pf-voltage-label';
    overlay.style.color = color;
    overlay.innerHTML = `${br.v_pu} pu<br>${br.v_kv} kV<br>${br.angle_deg}°`;
    el.appendChild(overlay);
  }
}
