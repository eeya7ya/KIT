/**
 * simulator.js — Power System Simulator for KIT
 *
 * Modules:
 *   1. SLD — Single Line Diagram (canvas-based drawing)
 *   2. PF  — Power Flow Analysis (Newton-Raphson / Gauss-Seidel / FDLF)
 *   3. SC  — Short Circuit Analysis (IEC 60909)
 *   4. VD  — Voltage Drop & Cable Sizing
 *   5. PROT — Protection Coordination (TCC curves)
 */

'use strict';

/* ════════════════════════════════════════════════════════
   GLOBAL STATE
   ════════════════════════════════════════════════════════ */

const PSS = {
  // Network model — shared across all modules
  buses: [],        // {id, name, x, y, rotation, type:'slack'|'pv'|'pq', vpu, angle, pgen, qgen, pload, qload, vnom_kv}
  generators: [],   // {id, name, busId, x, y, rotation, pgen, qgen, xd_pu, vset}
  transformers: [], // {id, name, from, to, x, y, rotation, srated_mva, vhv_kv, vlv_kv, zpu, tappu}
  loads: [],        // {id, name, busId, x, y, rotation, pload_mw, qload_mvar}
  lines: [],        // {id, name, from, to, x, y, rotation, r_pu, x_pu, b_pu, length_km, ratedI}
  cables: [],       // {id, name, from, to, x, y, rotation, r_ohm_km, x_ohm_km, length_km, size_mm2, material}
  motors: [],       // {id, name, busId, x, y, rotation, prated_kw, eff, pf, xlr}
  switches: [],     // {id, name, x, y, rotation, state:'open'|'closed', from, to, ratedI, ratedV_kv}
  breakers: [],     // {id, name, x, y, rotation, state:'open'|'closed', from, to, ratedI, ratedV_kv, breakingCapacity_kA}
  cts: [],          // {id, name, x, y, rotation, busId, ratio_primary, ratio_secondary, accuracy_class, burden_va}
  relays: [],       // {id, name, x, y, rotation, busId, relayType:'overcurrent'|'differential'|'distance', pickup, tms, curveType}
  connections: [],  // {fromId, toId} — visual connections

  // SLD state
  nextId: 1,
  selectedComp: null, // component type being placed
  selectedObj: null,   // selected object on canvas
  dragging: null,
  connectMode: null,   // first object for connection
  wireMode: false,     // wire drawing mode
  wireStart: null,     // first object in wire mode

  // Protection devices
  protDevices: [],

  // Canvas refs
  sldCtx: null,
  sldCanvas: null,
};

/* ════════════════════════════════════════════════════════
   INITIALIZATION
   ════════════════════════════════════════════════════════ */

function initSimulator() {
  if (PSS._initialized) return;
  PSS._initialized = true;

  initTabs();
  initSLD();
  initPF();
  initSC();
  initVD();
  initProtection();
}

/* ── Tab switching ──────────────────────────────────── */
function initTabs() {
  const tabs = document.querySelectorAll('.sim-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.sim-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('panel-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');

      if (tab.dataset.tab === 'sld') resizeSLDCanvas();
      if (tab.dataset.tab === 'prot') resizeTCCCanvas();

      // Resize mini-SLD canvases in analysis tabs
      requestAnimationFrame(() => resizeMiniSLDs());
    });
  });
}

/* ── Mini-SLD canvases in analysis tabs ───────────── */
function resizeMiniSLDs() {
  ['pf', 'sc', 'vd', 'prot'].forEach(tab => {
    const canvas = document.getElementById('mini-sld-' + tab);
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    drawMiniSLD(canvas);
  });
}

function drawMiniSLD(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, W, H);

  // Calculate bounding box to scale the SLD to fit
  const all = getAllObjects();
  if (all.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No components placed on SLD', W / 2, H / 2);
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of all) {
    minX = Math.min(minX, obj.x - 40);
    minY = Math.min(minY, obj.y - 40);
    maxX = Math.max(maxX, obj.x + 40);
    maxY = Math.max(maxY, obj.y + 40);
  }

  const sldW = maxX - minX || 1;
  const sldH = maxY - minY || 1;
  const pad = 20;
  const scaleX = (W - 2 * pad) / sldW;
  const scaleY = (H - 2 * pad) / sldH;
  const scale = Math.min(scaleX, scaleY, 1.5);
  const offX = pad + ((W - 2 * pad) - sldW * scale) / 2 - minX * scale;
  const offY = pad + ((H - 2 * pad) - sldH * scale) / 2 - minY * scale;

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  // Draw connections
  ctx.strokeStyle = 'rgba(255,215,0,0.4)';
  ctx.lineWidth = 2 / scale;
  for (const conn of PSS.connections) {
    const a = findObjById(conn.fromId);
    const b = findObjById(conn.toId);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Draw components (mini versions)
  for (const bus of PSS.buses) drawBus(ctx, bus, 1 / scale);
  for (const gen of PSS.generators) drawGenerator(ctx, gen, 1 / scale);
  for (const xfmr of PSS.transformers) drawTransformer(ctx, xfmr, 1 / scale);
  for (const load of PSS.loads) drawLoad(ctx, load, 1 / scale);
  for (const motor of PSS.motors) drawMotor(ctx, motor, 1 / scale);
  for (const line of PSS.lines) drawLine(ctx, line, 1 / scale);
  for (const cable of PSS.cables) drawCable(ctx, cable, 1 / scale);
  for (const sw of PSS.switches) drawSwitch(ctx, sw, 1 / scale);
  for (const cb of PSS.breakers) drawBreaker(ctx, cb, 1 / scale);
  for (const ct of PSS.cts) drawCT(ctx, ct, 1 / scale);
  for (const relay of PSS.relays) drawRelay(ctx, relay, 1 / scale);

  ctx.restore();
}

/* ════════════════════════════════════════════════════════
   MODULE 1: SLD — Single Line Diagram
   ════════════════════════════════════════════════════════ */

function initSLD() {
  PSS.sldCanvas = document.getElementById('sld-canvas');
  PSS.sldCtx = PSS.sldCanvas.getContext('2d');

  resizeSLDCanvas();
  window.addEventListener('resize', () => { resizeSLDCanvas(); resizeMiniSLDs(); });

  // Toolbar buttons
  document.querySelectorAll('#sld-toolbar .tb-btn[data-comp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wasActive = btn.classList.contains('active');
      document.querySelectorAll('#sld-toolbar .tb-btn[data-comp]').forEach(b => b.classList.remove('active'));
      PSS.wireMode = false;
      const wireBtn = document.getElementById('btn-wire');
      if (wireBtn) wireBtn.classList.remove('active');
      if (!wasActive) {
        btn.classList.add('active');
        PSS.selectedComp = btn.dataset.comp;
      } else {
        PSS.selectedComp = null;
      }
      PSS.connectMode = null;
      updateStatus();
    });
  });

  document.getElementById('btn-delete').addEventListener('click', deleteSelected);
  document.getElementById('btn-clear').addEventListener('click', clearAll);

  // Wire mode button
  const wireBtn = document.getElementById('btn-wire');
  if (wireBtn) {
    wireBtn.addEventListener('click', () => {
      PSS.wireMode = !PSS.wireMode;
      wireBtn.classList.toggle('active', PSS.wireMode);
      if (PSS.wireMode) {
        document.querySelectorAll('#sld-toolbar .tb-btn[data-comp]').forEach(b => b.classList.remove('active'));
        PSS.selectedComp = null;
        PSS.wireStart = null;
        updateStatus('Wire mode — Click a component to start, click another to connect');
      } else {
        PSS.wireStart = null;
        updateStatus();
      }
      drawSLD();
    });
  }

  // Rotate button
  const rotateBtn = document.getElementById('btn-rotate');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', rotateSelected);
  }

  // Canvas events
  PSS.sldCanvas.addEventListener('mousedown', sldMouseDown);
  PSS.sldCanvas.addEventListener('mousemove', sldMouseMove);
  PSS.sldCanvas.addEventListener('mouseup', sldMouseUp);
  PSS.sldCanvas.addEventListener('dblclick', sldDoubleClick);

  // Keyboard shortcut: Ctrl+R to rotate selected component
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      rotateSelected();
    }
    if (e.key === 'Delete') {
      deleteSelected();
    }
  });

  drawSLD();
}

function rotateSelected() {
  if (!PSS.selectedObj) { updateStatus('Select a component first, then press Ctrl+R to rotate'); return; }
  const real = findObjById(PSS.selectedObj.id);
  if (!real) return;
  real.rotation = ((real.rotation || 0) + 90) % 360;
  updateStatus(real.name + ' rotated to ' + real.rotation + '\u00B0');
  drawSLD();
  resizeMiniSLDs();
}

function resizeSLDCanvas() {
  if (!PSS.sldCanvas) return;
  const parent = PSS.sldCanvas.parentElement;
  PSS.sldCanvas.width = parent.clientWidth;
  PSS.sldCanvas.height = parent.clientHeight;
  drawSLD();
}

function updateStatus(msg) {
  const el = document.getElementById('sld-status');
  if (msg) { el.textContent = msg; return; }
  if (PSS.selectedComp) {
    el.textContent = `Placing: ${PSS.selectedComp.toUpperCase()} — Click on canvas to place`;
  } else if (PSS.connectMode) {
    el.textContent = 'Connection mode — Click a second component to connect';
  } else {
    el.textContent = 'Click component to place. Use Wire to connect. Ctrl+R to rotate. Drag to move.';
  }
}

function getObjAt(x, y) {
  const all = getAllObjects();
  for (const obj of all) {
    const dx = x - obj.x;
    const dy = y - obj.y;
    if (Math.sqrt(dx * dx + dy * dy) < 28) return obj;
  }
  return null;
}

function getAllObjects() {
  return [
    ...PSS.buses.map(o => ({...o, _type: 'bus'})),
    ...PSS.generators.map(o => ({...o, _type: 'generator'})),
    ...PSS.transformers.map(o => ({...o, _type: 'transformer'})),
    ...PSS.loads.map(o => ({...o, _type: 'load'})),
    ...PSS.motors.map(o => ({...o, _type: 'motor'})),
    ...PSS.lines.map(o => ({...o, _type: 'line'})),
    ...PSS.cables.map(o => ({...o, _type: 'cable'})),
    ...PSS.switches.map(o => ({...o, _type: 'switch'})),
    ...PSS.breakers.map(o => ({...o, _type: 'breaker'})),
    ...PSS.cts.map(o => ({...o, _type: 'ct'})),
    ...PSS.relays.map(o => ({...o, _type: 'relay'})),
  ];
}

function findObjById(id) {
  for (const arr of [PSS.buses, PSS.generators, PSS.transformers, PSS.loads, PSS.motors, PSS.lines, PSS.cables, PSS.switches, PSS.breakers, PSS.cts, PSS.relays]) {
    const found = arr.find(o => o.id === id);
    if (found) return found;
  }
  return null;
}

function getObjType(id) {
  if (PSS.buses.find(o => o.id === id)) return 'bus';
  if (PSS.generators.find(o => o.id === id)) return 'generator';
  if (PSS.transformers.find(o => o.id === id)) return 'transformer';
  if (PSS.loads.find(o => o.id === id)) return 'load';
  if (PSS.motors.find(o => o.id === id)) return 'motor';
  if (PSS.lines.find(o => o.id === id)) return 'line';
  if (PSS.cables.find(o => o.id === id)) return 'cable';
  if (PSS.switches.find(o => o.id === id)) return 'switch';
  if (PSS.breakers.find(o => o.id === id)) return 'breaker';
  if (PSS.cts.find(o => o.id === id)) return 'ct';
  if (PSS.relays.find(o => o.id === id)) return 'relay';
  return null;
}

/* ── SLD Mouse Events ──────────────────────────────── */
function sldMouseDown(e) {
  const rect = PSS.sldCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (PSS.selectedComp) {
    placeComponent(PSS.selectedComp, x, y);
    return;
  }

  // Wire mode: click components to connect them
  if (PSS.wireMode) {
    const obj = getObjAt(x, y);
    if (obj) {
      if (!PSS.wireStart) {
        PSS.wireStart = obj;
        updateStatus('Wire from ' + obj.name + ' — Click another component to connect');
        PSS.selectedObj = obj;
        drawSLD();
      } else {
        if (PSS.wireStart.id !== obj.id) {
          PSS.connections.push({ fromId: PSS.wireStart.id, toId: obj.id });
          updateStatus('Connected ' + PSS.wireStart.name + ' → ' + obj.name);
          resizeMiniSLDs();
        }
        PSS.wireStart = null;
        drawSLD();
      }
    }
    return;
  }

  const obj = getObjAt(x, y);
  if (obj) {
    PSS.selectedObj = obj;
    PSS.dragging = { obj, offX: x - obj.x, offY: y - obj.y };
    showProperties(obj);
    drawSLD();
  } else {
    PSS.selectedObj = null;
    PSS.connectMode = null;
    clearProperties();
    drawSLD();
  }
}

function sldMouseMove(e) {
  if (!PSS.dragging) return;
  const rect = PSS.sldCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const real = findObjById(PSS.dragging.obj.id);
  if (real) {
    real.x = x - PSS.dragging.offX;
    real.y = y - PSS.dragging.offY;
    drawSLD();
  }
}

function sldMouseUp() {
  if (PSS.dragging) {
    PSS.dragging = null;
    resizeMiniSLDs();
  }
}

function sldDoubleClick(e) {
  const rect = PSS.sldCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const obj = getObjAt(x, y);
  if (!obj) return;

  if (!PSS.connectMode) {
    PSS.connectMode = obj;
    updateStatus('Connection mode — Click a second component to connect');
  } else {
    if (PSS.connectMode.id !== obj.id) {
      PSS.connections.push({ fromId: PSS.connectMode.id, toId: obj.id });
      updateStatus('Connected ' + PSS.connectMode.name + ' → ' + obj.name);
    }
    PSS.connectMode = null;
    drawSLD();
  }
}

/* ── Place Component ───────────────────────────────── */
function placeComponent(type, x, y) {
  const id = PSS.nextId++;
  const typeLabels = { bus: 'Bus', generator: 'Gen', transformer: 'Xfmr', load: 'Load', line: 'Line', cable: 'Cable', motor: 'Motor', switch: 'SW', breaker: 'CB', ct: 'CT', relay: 'Relay' };
  const name = (typeLabels[type] || type) + ' ' + id;

  switch (type) {
    case 'bus':
      PSS.buses.push({ id, name, x, y, rotation: 0, type: PSS.buses.length === 0 ? 'slack' : 'pq', vpu: 1.0, angle: 0, pgen: 0, qgen: 0, pload: 0, qload: 0, vnom_kv: 11 });
      break;
    case 'generator':
      PSS.generators.push({ id, name, busId: null, x, y, rotation: 0, pgen: 50, qgen: 0, xd_pu: 0.15, vset: 1.0 });
      break;
    case 'transformer':
      PSS.transformers.push({ id, name, from: null, to: null, x, y, rotation: 0, srated_mva: 10, vhv_kv: 33, vlv_kv: 11, zpu: 0.06, tappu: 1.0 });
      break;
    case 'load':
      PSS.loads.push({ id, name, busId: null, x, y, rotation: 0, pload_mw: 5, qload_mvar: 2 });
      break;
    case 'line':
      PSS.lines.push({ id, name, from: null, to: null, x, y, rotation: 0, r_pu: 0.01, x_pu: 0.1, b_pu: 0.02, length_km: 10, ratedI: 400 });
      break;
    case 'cable':
      PSS.cables.push({ id, name, from: null, to: null, x, y, rotation: 0, r_ohm_km: 0.193, x_ohm_km: 0.08, length_km: 0.5, size_mm2: 95, material: 'cu' });
      break;
    case 'motor':
      PSS.motors.push({ id, name, busId: null, x, y, rotation: 0, prated_kw: 100, eff: 0.92, pf: 0.85, xlr: 6 });
      break;
    case 'switch':
      PSS.switches.push({ id, name, x, y, rotation: 0, state: 'closed', from: null, to: null, ratedI: 400, ratedV_kv: 11 });
      break;
    case 'breaker':
      PSS.breakers.push({ id, name, x, y, rotation: 0, state: 'closed', from: null, to: null, ratedI: 630, ratedV_kv: 11, breakingCapacity_kA: 25 });
      break;
    case 'ct':
      PSS.cts.push({ id, name, x, y, rotation: 0, busId: null, ratio_primary: 200, ratio_secondary: 5, accuracy_class: '5P20', burden_va: 15 });
      break;
    case 'relay':
      PSS.relays.push({ id, name, x, y, rotation: 0, busId: null, relayType: 'overcurrent', pickup: 100, tms: 0.1, curveType: 'si' });
      break;
  }

  // Deselect component placement
  document.querySelectorAll('#sld-toolbar .tb-btn[data-comp]').forEach(b => b.classList.remove('active'));
  PSS.selectedComp = null;
  updateStatus(name + ' placed');
  drawSLD();
  syncBusSelectors();
  resizeMiniSLDs();
}

function deleteSelected() {
  if (!PSS.selectedObj) { updateStatus('Nothing selected'); return; }
  const id = PSS.selectedObj.id;
  PSS.buses = PSS.buses.filter(o => o.id !== id);
  PSS.generators = PSS.generators.filter(o => o.id !== id);
  PSS.transformers = PSS.transformers.filter(o => o.id !== id);
  PSS.loads = PSS.loads.filter(o => o.id !== id);
  PSS.motors = PSS.motors.filter(o => o.id !== id);
  PSS.lines = PSS.lines.filter(o => o.id !== id);
  PSS.cables = PSS.cables.filter(o => o.id !== id);
  PSS.switches = PSS.switches.filter(o => o.id !== id);
  PSS.breakers = PSS.breakers.filter(o => o.id !== id);
  PSS.cts = PSS.cts.filter(o => o.id !== id);
  PSS.relays = PSS.relays.filter(o => o.id !== id);
  PSS.connections = PSS.connections.filter(c => c.fromId !== id && c.toId !== id);
  PSS.selectedObj = null;
  clearProperties();
  updateStatus('Deleted');
  drawSLD();
  syncBusSelectors();
  resizeMiniSLDs();
}

function clearAll() {
  PSS.buses = []; PSS.generators = []; PSS.transformers = []; PSS.loads = [];
  PSS.lines = []; PSS.cables = []; PSS.motors = []; PSS.connections = [];
  PSS.switches = []; PSS.breakers = []; PSS.cts = []; PSS.relays = [];
  PSS.selectedObj = null; PSS.connectMode = null; PSS.wireStart = null; PSS.nextId = 1;
  clearProperties();
  updateStatus('Canvas cleared');
  drawSLD();
  syncBusSelectors();
  resizeMiniSLDs();
}

/* ── Draw SLD ──────────────────────────────────────── */
function drawSLD() {
  const ctx = PSS.sldCtx;
  const W = PSS.sldCanvas.width;
  const H = PSS.sldCanvas.height;
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // Draw grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Draw connections
  ctx.strokeStyle = 'rgba(255,215,0,0.4)';
  ctx.lineWidth = 2;
  for (const conn of PSS.connections) {
    const a = findObjById(conn.fromId);
    const b = findObjById(conn.toId);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Draw components
  for (const bus of PSS.buses) drawBus(ctx, bus);
  for (const gen of PSS.generators) drawGenerator(ctx, gen);
  for (const xfmr of PSS.transformers) drawTransformer(ctx, xfmr);
  for (const load of PSS.loads) drawLoad(ctx, load);
  for (const motor of PSS.motors) drawMotor(ctx, motor);
  for (const line of PSS.lines) drawLine(ctx, line);
  for (const cable of PSS.cables) drawCable(ctx, cable);
  for (const sw of PSS.switches) drawSwitch(ctx, sw);
  for (const cb of PSS.breakers) drawBreaker(ctx, cb);
  for (const ct of PSS.cts) drawCT(ctx, ct);
  for (const relay of PSS.relays) drawRelay(ctx, relay);

  // Selection highlight
  if (PSS.selectedObj) {
    const obj = findObjById(PSS.selectedObj.id);
    if (obj) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Connect mode highlight
  if (PSS.connectMode) {
    const obj = findObjById(PSS.connectMode.id);
    if (obj) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Wire mode start highlight
  if (PSS.wireMode && PSS.wireStart) {
    const obj = findObjById(PSS.wireStart.id);
    if (obj) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawBus(ctx, bus, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === bus.id;
  const rot = (bus.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(bus.x, bus.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#ffffff';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(30, 0);
  ctx.stroke();

  ctx.restore();

  // Labels (not rotated)
  ctx.fillStyle = '#FFD700';
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bus.name, bus.x, bus.y - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(bus.vnom_kv + ' kV | ' + bus.type, bus.x, bus.y + 18);
}

function drawGenerator(ctx, gen, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === gen.id;
  const rot = (gen.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(gen.x, gen.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#4ade80';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = isSelected ? '#FFD700' : '#4ade80';
  ctx.font = 'bold 14px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', 0, 0);
  ctx.textBaseline = 'alphabetic';

  // Connection stub
  ctx.strokeStyle = isSelected ? '#FFD700' : '#4ade80';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -28);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(gen.name, gen.x, gen.y - 32);
}

function drawTransformer(ctx, xfmr, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === xfmr.id;
  const rot = (xfmr.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(xfmr.x, xfmr.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#a78bfa';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(-7, 0, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(7, 0, 14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(xfmr.name, xfmr.x, xfmr.y - 22);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(xfmr.srated_mva + ' MVA', xfmr.x, xfmr.y + 24);
}

function drawLoad(ctx, load, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === load.id;
  const rot = (load.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(load.x, load.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#f87171';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-14, 14);
  ctx.lineTo(14, 14);
  ctx.closePath();
  ctx.stroke();

  // Connection stub
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -24);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(load.name, load.x, load.y - 28);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(load.pload_mw + ' MW', load.x, load.y + 28);
}

function drawMotor(ctx, motor, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === motor.id;
  const rot = (motor.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(motor.x, motor.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#38bdf8';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = isSelected ? '#FFD700' : '#38bdf8';
  ctx.font = 'bold 14px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', 0, 0);
  ctx.textBaseline = 'alphabetic';

  // Connection stub
  ctx.strokeStyle = isSelected ? '#FFD700' : '#38bdf8';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -28);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(motor.name, motor.x, motor.y - 32);
}

/* ── New Component Drawing Functions ─────────────── */

function drawLine(ctx, line, lwScale) {
  const s = lwScale || 1;
  if (line.x === undefined || line.y === undefined) return;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === line.id;
  const rot = (line.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(line.x, line.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#fb923c';
  ctx.lineWidth = 1.5 * s;
  // Transmission line symbol: zigzag
  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-15, -8);
  ctx.lineTo(-7, 8);
  ctx.lineTo(1, -8);
  ctx.lineTo(9, 8);
  ctx.lineTo(15, -8);
  ctx.lineTo(20, 0);
  ctx.lineTo(28, 0);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(line.name, line.x, line.y - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(line.length_km + ' km', line.x, line.y + 18);
}

function drawCable(ctx, cable, lwScale) {
  const s = lwScale || 1;
  if (cable.x === undefined || cable.y === undefined) return;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === cable.id;
  const rot = (cable.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(cable.x, cable.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#94a3b8';
  ctx.lineWidth = 2.5 * s;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(28, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  // Small circles at ends
  ctx.fillStyle = isSelected ? '#FFD700' : '#94a3b8';
  ctx.beginPath();
  ctx.arc(-28, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(28, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cable.name, cable.x, cable.y - 14);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(cable.size_mm2 + ' mm\u00B2 | ' + cable.length_km + ' km', cable.x, cable.y + 18);
}

function drawSwitch(ctx, sw, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === sw.id;
  const rot = (sw.rotation || 0) * Math.PI / 180;
  const closed = sw.state === 'closed';

  ctx.save();
  ctx.translate(sw.x, sw.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : (closed ? '#4ade80' : '#f87171');
  ctx.lineWidth = 2 * s;

  // Left terminal
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-8, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-8, 0, 3, 0, Math.PI * 2);
  ctx.stroke();

  // Right terminal
  ctx.beginPath();
  ctx.arc(8, 0, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();

  // Blade
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  if (closed) {
    ctx.lineTo(5, 0);
  } else {
    ctx.lineTo(3, -12);
  }
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sw.name, sw.x, sw.y - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(sw.state, sw.x, sw.y + 18);
}

function drawBreaker(ctx, cb, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === cb.id;
  const rot = (cb.rotation || 0) * Math.PI / 180;
  const closed = cb.state === 'closed';

  ctx.save();
  ctx.translate(cb.x, cb.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : (closed ? '#4ade80' : '#f87171');
  ctx.lineWidth = 2 * s;

  // Square breaker symbol
  ctx.strokeRect(-10, -10, 20, 20);

  // X inside when closed, gap when open
  if (closed) {
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(7, 7);
    ctx.moveTo(7, -7);
    ctx.lineTo(-7, 7);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, 7);
    ctx.lineTo(0, -2);
    ctx.stroke();
  }

  // Terminals
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, -22);
  ctx.moveTo(0, 10);
  ctx.lineTo(0, 22);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cb.name, cb.x, cb.y - 28);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(cb.ratedI + 'A | ' + cb.state, cb.x, cb.y + 32);
}

function drawCT(ctx, ct, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === ct.id;
  const rot = (ct.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(ct.x, ct.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#e879f9';
  ctx.lineWidth = 1.5 * s;

  // CT symbol: two concentric circles with line through
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Through conductor
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 18);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ct.name, ct.x, ct.y - 24);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(ct.ratio_primary + '/' + ct.ratio_secondary + ' A', ct.x, ct.y + 26);
}

function drawRelay(ctx, relay, lwScale) {
  const s = lwScale || 1;
  const isSelected = PSS.selectedObj && PSS.selectedObj.id === relay.id;
  const rot = (relay.rotation || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(relay.x, relay.y);
  ctx.rotate(rot);

  ctx.strokeStyle = isSelected ? '#FFD700' : '#22d3ee';
  ctx.lineWidth = 1.5 * s;

  // Relay symbol: rectangle with contacts
  ctx.strokeRect(-14, -10, 28, 20);

  // Relay type abbreviation inside
  const typeLabels = { overcurrent: 'OC', differential: 'DF', distance: 'DZ' };
  ctx.fillStyle = isSelected ? '#FFD700' : '#22d3ee';
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(typeLabels[relay.relayType] || 'R', 0, 0);
  ctx.textBaseline = 'alphabetic';

  // Contact pins
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, -20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(-8, 18);
  ctx.moveTo(8, 10);
  ctx.lineTo(8, 18);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#FFD700';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(relay.name, relay.x, relay.y - 26);
}

/* ── Properties Panel ──────────────────────────────── */
function showProperties(obj) {
  const container = document.getElementById('props-content');
  const type = obj._type || getObjType(obj.id);
  const real = findObjById(obj.id);
  if (!real) return;

  let html = `<div class="form-row"><label>Name</label><input type="text" value="${real.name}" onchange="updateProp(${real.id},'name',this.value)"/></div>`;

  // Rotation for all types
  html += propInput(real.id, 'rotation', 'Rotation (\u00B0)', real.rotation || 0, 'number');

  switch (type) {
    case 'bus':
      html += propSelect(real.id, 'type', 'Bus Type', real.type, ['slack', 'pv', 'pq']);
      html += propInput(real.id, 'vnom_kv', 'Nominal kV', real.vnom_kv, 'number');
      html += propInput(real.id, 'vpu', 'V (p.u.)', real.vpu, 'number');
      html += propInput(real.id, 'angle', 'Angle (deg)', real.angle, 'number');
      html += propInput(real.id, 'pgen', 'P Gen (MW)', real.pgen, 'number');
      html += propInput(real.id, 'qgen', 'Q Gen (Mvar)', real.qgen, 'number');
      html += propInput(real.id, 'pload', 'P Load (MW)', real.pload, 'number');
      html += propInput(real.id, 'qload', 'Q Load (Mvar)', real.qload, 'number');
      break;
    case 'generator':
      html += propBusSelect(real.id, 'busId', 'Connected Bus', real.busId);
      html += propInput(real.id, 'pgen', 'P Gen (MW)', real.pgen, 'number');
      html += propInput(real.id, 'xd_pu', "X'd (p.u.)", real.xd_pu, 'number');
      html += propInput(real.id, 'vset', 'V Setpoint (p.u.)', real.vset, 'number');
      break;
    case 'transformer':
      html += propBusSelect(real.id, 'from', 'HV Bus', real.from);
      html += propBusSelect(real.id, 'to', 'LV Bus', real.to);
      html += propInput(real.id, 'srated_mva', 'Rating (MVA)', real.srated_mva, 'number');
      html += propInput(real.id, 'vhv_kv', 'HV (kV)', real.vhv_kv, 'number');
      html += propInput(real.id, 'vlv_kv', 'LV (kV)', real.vlv_kv, 'number');
      html += propInput(real.id, 'zpu', 'Z (p.u.)', real.zpu, 'number');
      html += propInput(real.id, 'tappu', 'Tap (p.u.)', real.tappu, 'number');
      break;
    case 'load':
      html += propBusSelect(real.id, 'busId', 'Connected Bus', real.busId);
      html += propInput(real.id, 'pload_mw', 'P Load (MW)', real.pload_mw, 'number');
      html += propInput(real.id, 'qload_mvar', 'Q Load (Mvar)', real.qload_mvar, 'number');
      break;
    case 'motor':
      html += propBusSelect(real.id, 'busId', 'Connected Bus', real.busId);
      html += propInput(real.id, 'prated_kw', 'Rated P (kW)', real.prated_kw, 'number');
      html += propInput(real.id, 'eff', 'Efficiency', real.eff, 'number');
      html += propInput(real.id, 'pf', 'Power Factor', real.pf, 'number');
      html += propInput(real.id, 'xlr', 'Xlr (LRC multiple)', real.xlr, 'number');
      break;
    case 'line':
      html += propBusSelect(real.id, 'from', 'From Bus', real.from);
      html += propBusSelect(real.id, 'to', 'To Bus', real.to);
      html += propInput(real.id, 'r_pu', 'R (p.u.)', real.r_pu, 'number');
      html += propInput(real.id, 'x_pu', 'X (p.u.)', real.x_pu, 'number');
      html += propInput(real.id, 'b_pu', 'B (p.u.)', real.b_pu, 'number');
      html += propInput(real.id, 'length_km', 'Length (km)', real.length_km, 'number');
      html += propInput(real.id, 'ratedI', 'Rated I (A)', real.ratedI, 'number');
      break;
    case 'cable':
      html += propBusSelect(real.id, 'from', 'From Bus', real.from);
      html += propBusSelect(real.id, 'to', 'To Bus', real.to);
      html += propInput(real.id, 'r_ohm_km', 'R (\u03A9/km)', real.r_ohm_km, 'number');
      html += propInput(real.id, 'x_ohm_km', 'X (\u03A9/km)', real.x_ohm_km, 'number');
      html += propInput(real.id, 'length_km', 'Length (km)', real.length_km, 'number');
      html += propInput(real.id, 'size_mm2', 'Size (mm\u00B2)', real.size_mm2, 'number');
      html += propSelect(real.id, 'material', 'Material', real.material, ['cu', 'al']);
      break;
    case 'switch':
      html += propSelect(real.id, 'state', 'State', real.state, ['open', 'closed']);
      html += propBusSelect(real.id, 'from', 'From Bus', real.from);
      html += propBusSelect(real.id, 'to', 'To Bus', real.to);
      html += propInput(real.id, 'ratedI', 'Rated I (A)', real.ratedI, 'number');
      html += propInput(real.id, 'ratedV_kv', 'Rated V (kV)', real.ratedV_kv, 'number');
      break;
    case 'breaker':
      html += propSelect(real.id, 'state', 'State', real.state, ['open', 'closed']);
      html += propBusSelect(real.id, 'from', 'From Bus', real.from);
      html += propBusSelect(real.id, 'to', 'To Bus', real.to);
      html += propInput(real.id, 'ratedI', 'Rated I (A)', real.ratedI, 'number');
      html += propInput(real.id, 'ratedV_kv', 'Rated V (kV)', real.ratedV_kv, 'number');
      html += propInput(real.id, 'breakingCapacity_kA', 'Breaking (kA)', real.breakingCapacity_kA, 'number');
      break;
    case 'ct':
      html += propBusSelect(real.id, 'busId', 'Connected Bus', real.busId);
      html += propInput(real.id, 'ratio_primary', 'Primary (A)', real.ratio_primary, 'number');
      html += propInput(real.id, 'ratio_secondary', 'Secondary (A)', real.ratio_secondary, 'number');
      html += propSelect(real.id, 'accuracy_class', 'Accuracy Class', real.accuracy_class, ['5P10', '5P20', '10P10', '10P20', '0.5', '0.2']);
      html += propInput(real.id, 'burden_va', 'Burden (VA)', real.burden_va, 'number');
      break;
    case 'relay':
      html += propBusSelect(real.id, 'busId', 'Connected Bus', real.busId);
      html += propSelect(real.id, 'relayType', 'Relay Type', real.relayType, ['overcurrent', 'differential', 'distance']);
      html += propSelect(real.id, 'curveType', 'Curve Type', real.curveType || 'si', ['si', 'vi', 'ei', 'lti']);
      html += propInput(real.id, 'pickup', 'Pickup (A)', real.pickup, 'number');
      html += propInput(real.id, 'tms', 'TMS', real.tms, 'number');
      break;
  }

  container.innerHTML = html;
}

function propInput(id, key, label, value, type) {
  return `<div class="form-row"><label>${label}</label><input type="${type}" value="${value}" step="any" onchange="updateProp(${id},'${key}',this.value)"/></div>`;
}

function propSelect(id, key, label, value, options) {
  const opts = options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('');
  return `<div class="form-row"><label>${label}</label><select onchange="updateProp(${id},'${key}',this.value)">${opts}</select></div>`;
}

function propBusSelect(id, key, label, value) {
  let opts = `<option value="">— None —</option>`;
  for (const bus of PSS.buses) {
    opts += `<option value="${bus.id}" ${bus.id === value ? 'selected' : ''}>${bus.name} (${bus.vnom_kv} kV)</option>`;
  }
  return `<div class="form-row"><label>${label}</label><select onchange="updateProp(${id},'${key}',this.value)">${opts}</select></div>`;
}

function updateProp(id, key, value) {
  const obj = findObjById(id);
  if (!obj) return;
  if (key === 'name' || key === 'type' || key === 'material' || key === 'state' || key === 'accuracy_class' || key === 'relayType' || key === 'curveType') {
    obj[key] = value;
  } else if (key === 'busId' || key === 'from' || key === 'to') {
    obj[key] = value ? parseInt(value) : null;
  } else {
    obj[key] = parseFloat(value);
  }
  drawSLD();
  syncBusSelectors();
  resizeMiniSLDs();
}

function clearProperties() {
  document.getElementById('props-content').innerHTML = '<p class="props-empty">Select a component to edit its properties</p>';
}

function syncBusSelectors() {
  // Update the SC fault bus selector
  const scBus = document.getElementById('sc-faultbus');
  if (scBus) {
    const current = scBus.value;
    scBus.innerHTML = '<option value="">— Select Bus —</option>';
    for (const bus of PSS.buses) {
      scBus.innerHTML += `<option value="${bus.id}" ${bus.id == current ? 'selected' : ''}>${bus.name} (${bus.vnom_kv} kV)</option>`;
    }
  }
}


/* ════════════════════════════════════════════════════════
   MODULE 2: POWER FLOW ANALYSIS
   ════════════════════════════════════════════════════════ */

function initPF() {
  document.getElementById('btn-run-pf').addEventListener('click', runPowerFlow);
  document.getElementById('btn-export-pf').addEventListener('click', () => exportResults('pf'));
}

function runPowerFlow() {
  const buses = PSS.buses;
  if (buses.length < 2) {
    document.getElementById('pf-results').innerHTML = '<h4>Results</h4><p class="result-warn">Need at least 2 buses to run power flow.</p>';
    return;
  }

  const method = document.getElementById('pf-method').value;
  const maxIter = parseInt(document.getElementById('pf-maxiter').value);
  const tol = parseFloat(document.getElementById('pf-tol').value);
  const baseMVA = parseFloat(document.getElementById('pf-basemva').value);

  // Aggregate loads and generation onto buses
  for (const bus of buses) {
    bus._pload = bus.pload || 0;
    bus._qload = bus.qload || 0;
    bus._pgen = bus.pgen || 0;
    bus._qgen = bus.qgen || 0;
  }
  for (const load of PSS.loads) {
    const bus = buses.find(b => b.id === load.busId);
    if (bus) { bus._pload += load.pload_mw; bus._qload += load.qload_mvar; }
  }
  for (const gen of PSS.generators) {
    const bus = buses.find(b => b.id === gen.busId);
    if (bus) { bus._pgen += gen.pgen; }
  }
  for (const motor of PSS.motors) {
    const bus = buses.find(b => b.id === motor.busId);
    if (bus) {
      const pmw = motor.prated_kw / 1000 / motor.eff;
      const qmvar = pmw * Math.tan(Math.acos(motor.pf));
      bus._pload += pmw;
      bus._qload += qmvar;
    }
  }

  // Build Y-bus (simplified — using connections and transformer/line impedances)
  const n = buses.length;
  const busIndex = {};
  buses.forEach((b, i) => busIndex[b.id] = i);

  // Initialize Y-bus as complex matrix
  const Yr = Array.from({length: n}, () => new Float64Array(n));
  const Yi = Array.from({length: n}, () => new Float64Array(n));

  // Add transformer admittances
  for (const xfmr of PSS.transformers) {
    const i = busIndex[xfmr.from];
    const j = busIndex[xfmr.to];
    if (i === undefined || j === undefined) continue;
    const r = 0;
    const x = xfmr.zpu;
    const g = r / (r * r + x * x);
    const b = -x / (r * r + x * x);
    Yr[i][i] += g; Yi[i][i] += b;
    Yr[j][j] += g; Yi[j][j] += b;
    Yr[i][j] -= g; Yi[i][j] -= b;
    Yr[j][i] -= g; Yi[j][i] -= b;
  }

  // Add line admittances
  for (const line of PSS.lines) {
    const i = busIndex[line.from];
    const j = busIndex[line.to];
    if (i === undefined || j === undefined) continue;
    const r = line.r_pu;
    const x = line.x_pu;
    const denom = r * r + x * x;
    const g = r / denom;
    const b = -x / denom;
    const bsh = line.b_pu / 2;
    Yr[i][i] += g; Yi[i][i] += b + bsh;
    Yr[j][j] += g; Yi[j][j] += b + bsh;
    Yr[i][j] -= g; Yi[i][j] -= b;
    Yr[j][i] -= g; Yi[j][i] -= b;
  }

  // Add cable admittances (convert to p.u.)
  for (const cable of PSS.cables) {
    const i = busIndex[cable.from];
    const j = busIndex[cable.to];
    if (i === undefined || j === undefined) continue;
    // Approximate: find bus voltage to compute Zbase
    const busI = buses[i];
    const Zbase = (busI.vnom_kv * busI.vnom_kv) / baseMVA;
    const r = cable.r_ohm_km * cable.length_km / Zbase;
    const x = cable.x_ohm_km * cable.length_km / Zbase;
    const denom = r * r + x * x;
    if (denom < 1e-12) continue;
    const g = r / denom;
    const b = -x / denom;
    Yr[i][i] += g; Yi[i][i] += b;
    Yr[j][j] += g; Yi[j][j] += b;
    Yr[i][j] -= g; Yi[i][j] -= b;
    Yr[j][i] -= g; Yi[j][i] -= b;
  }

  // Add connection-based admittances (for directly connected components with no impedance)
  for (const conn of PSS.connections) {
    const i = busIndex[conn.fromId];
    const j = busIndex[conn.toId];
    if (i === undefined || j === undefined) continue;
    // Check if already has admittance from lines/transformers
    if (Math.abs(Yr[i][j]) > 1e-12 || Math.abs(Yi[i][j]) > 1e-12) continue;
    // Add a very low impedance connection
    const g = 0;
    const b = -100; // ~0.01 p.u. reactance
    Yr[i][i] += g; Yi[i][i] += b;
    Yr[j][j] += g; Yi[j][j] += b;
    Yr[i][j] -= g; Yi[i][j] -= b;
    Yr[j][i] -= g; Yi[j][i] -= b;
  }

  // Gauss-Seidel solver
  const V = buses.map(b => b.vpu || 1.0);
  const theta = buses.map(b => (b.angle || 0) * Math.PI / 180);
  const Pspec = buses.map(b => (b._pgen - b._pload) / baseMVA);
  const Qspec = buses.map(b => (b._qgen - b._qload) / baseMVA);

  const slackIdx = buses.findIndex(b => b.type === 'slack');
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxMismatch = 0;
    iterations = iter + 1;

    for (let i = 0; i < n; i++) {
      if (i === slackIdx) continue;

      // Compute power injections
      let Pcalc = 0, Qcalc = 0;
      for (let j = 0; j < n; j++) {
        const thetaij = theta[i] - theta[j];
        Pcalc += V[j] * (Yr[i][j] * Math.cos(thetaij) + Yi[i][j] * Math.sin(thetaij));
        Qcalc += V[j] * (Yr[i][j] * Math.sin(thetaij) - Yi[i][j] * Math.cos(thetaij));
      }
      Pcalc *= V[i];
      Qcalc *= V[i];

      const dP = Pspec[i] - Pcalc;
      const dQ = Qspec[i] - Qcalc;

      maxMismatch = Math.max(maxMismatch, Math.abs(dP), Math.abs(dQ));

      // Update angle and voltage
      const Yii_mag = Math.sqrt(Yr[i][i] * Yr[i][i] + Yi[i][i] * Yi[i][i]);
      if (Yii_mag > 1e-12) {
        theta[i] += dP / (V[i] * Yii_mag) * 0.5;
        if (buses[i].type === 'pq') {
          V[i] += dQ / (V[i] * Yii_mag) * 0.5;
        }
      }
    }

    if (maxMismatch < tol) { converged = true; break; }
  }

  // Display results
  let html = `<h4>Results — ${method.toUpperCase()}</h4>`;
  html += `<p style="margin-bottom:12px;font-size:0.82rem;color:${converged ? '#4ade80' : '#f87171'}">`;
  html += converged ? `Converged in ${iterations} iterations` : `Did NOT converge after ${iterations} iterations`;
  html += `</p>`;

  html += `<table class="results-table"><thead><tr><th>Bus</th><th>V (p.u.)</th><th>Angle (°)</th><th>P (MW)</th><th>Q (Mvar)</th><th>Type</th></tr></thead><tbody>`;
  for (let i = 0; i < n; i++) {
    const vClass = V[i] >= 0.95 && V[i] <= 1.05 ? 'result-ok' : (V[i] >= 0.9 && V[i] <= 1.1 ? 'result-warn' : 'result-fail');
    html += `<tr>
      <td>${buses[i].name}</td>
      <td class="${vClass}">${V[i].toFixed(4)}</td>
      <td>${(theta[i] * 180 / Math.PI).toFixed(2)}</td>
      <td>${(Pspec[i] * baseMVA).toFixed(2)}</td>
      <td>${(Qspec[i] * baseMVA).toFixed(2)}</td>
      <td>${buses[i].type}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  document.getElementById('pf-results').innerHTML = html;
}


/* ════════════════════════════════════════════════════════
   MODULE 3: SHORT CIRCUIT ANALYSIS (IEC 60909)
   ════════════════════════════════════════════════════════ */

function initSC() {
  document.getElementById('btn-run-sc').addEventListener('click', runShortCircuit);
  document.getElementById('btn-export-sc').addEventListener('click', () => exportResults('sc'));
}

function runShortCircuit() {
  const faultType = document.getElementById('sc-faulttype').value;
  const faultBusId = parseInt(document.getElementById('sc-faultbus').value);
  const cFactor = parseFloat(document.getElementById('sc-cfactor').value);
  const baseMVA = parseFloat(document.getElementById('pf-basemva').value) || 100;

  if (!faultBusId) {
    document.getElementById('sc-results').innerHTML = '<h4>Results</h4><p class="result-warn">Please select a faulted bus.</p>';
    return;
  }

  const faultBus = PSS.buses.find(b => b.id === faultBusId);
  if (!faultBus) {
    document.getElementById('sc-results').innerHTML = '<h4>Results</h4><p class="result-fail">Faulted bus not found.</p>';
    return;
  }

  const Vnom = faultBus.vnom_kv;
  const Zbase = (Vnom * Vnom) / baseMVA; // ohms

  // Calculate total impedance at fault bus (simplified Thevenin equivalent)
  // Sum generator contributions
  let Ztotal_pu_r = 0;
  let Ztotal_pu_x = 0;
  let genCount = 0;

  // Direct generator impedances
  for (const gen of PSS.generators) {
    if (gen.busId === faultBusId || isConnectedTo(gen.id, faultBusId)) {
      Ztotal_pu_x += 1 / gen.xd_pu; // parallel admittance
      genCount++;
    }
  }

  // Transformer impedances
  for (const xfmr of PSS.transformers) {
    if (xfmr.from === faultBusId || xfmr.to === faultBusId) {
      Ztotal_pu_x += 1 / xfmr.zpu;
    }
  }

  // If no sources found, check connections
  if (genCount === 0) {
    // Add a default grid impedance (infinite bus assumption)
    const slackBus = PSS.buses.find(b => b.type === 'slack');
    if (slackBus) {
      // Assume grid SC level of 500 MVA
      const gridZ = baseMVA / 500;
      Ztotal_pu_x += 1 / gridZ;
    }
  }

  // Motor contributions (IEC 60909 considers motor contribution)
  for (const motor of PSS.motors) {
    if (motor.busId === faultBusId || isConnectedTo(motor.id, faultBusId)) {
      const motorMVA = motor.prated_kw / 1000 / motor.pf;
      const motorZ = baseMVA / (motorMVA * motor.xlr);
      Ztotal_pu_x += 1 / motorZ;
    }
  }

  if (Ztotal_pu_x < 1e-12) {
    document.getElementById('sc-results').innerHTML = '<h4>Results</h4><p class="result-warn">No sources connected to faulted bus. Check connections.</p>';
    return;
  }

  // Total Z (parallel combination)
  const Zk_pu = 1 / Ztotal_pu_x; // p.u. (mostly reactive)
  const Zk_ohm = Zk_pu * Zbase;

  // IEC 60909 calculations
  const Ik_3ph = (cFactor * Vnom * 1000) / (Math.sqrt(3) * Zk_ohm * 1000); // kA
  const Sk_3ph = Math.sqrt(3) * Vnom * Ik_3ph; // MVA
  const ip = Ik_3ph * 2.55; // Peak current (kappa = 1.8 for R/X ≈ 0)

  let Ik_result, Sk_result;
  let faultLabel;

  switch (faultType) {
    case '3ph':
      Ik_result = Ik_3ph;
      Sk_result = Sk_3ph;
      faultLabel = 'Three-Phase Fault';
      break;
    case 'slg':
      // SLG: Ik1 ≈ 3*Vph / (Z1+Z2+Z0), approximate Z0 ≈ 3*Z1
      Ik_result = Ik_3ph * 3 / 5; // approximation
      Sk_result = Sk_3ph * 3 / 5;
      faultLabel = 'Single Line-to-Ground';
      break;
    case 'll':
      Ik_result = Ik_3ph * Math.sqrt(3) / 2;
      Sk_result = Sk_3ph * Math.sqrt(3) / 2;
      faultLabel = 'Line-to-Line';
      break;
    case 'llg':
      Ik_result = Ik_3ph * 0.87; // approximation
      Sk_result = Sk_3ph * 0.87;
      faultLabel = 'Double Line-to-Ground';
      break;
  }

  let html = `<h4>Results — IEC 60909</h4>`;
  html += `<table class="results-table">
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Fault Type</td><td>${faultLabel}</td></tr>
      <tr><td>Faulted Bus</td><td>${faultBus.name} (${Vnom} kV)</td></tr>
      <tr><td>Voltage Factor c</td><td>${cFactor}</td></tr>
      <tr><td>Zk (p.u.)</td><td>${Zk_pu.toFixed(4)}</td></tr>
      <tr><td>Zk (Ω)</td><td>${Zk_ohm.toFixed(4)}</td></tr>
      <tr><td>Ik" (kA)</td><td class="result-warn">${Ik_result.toFixed(3)}</td></tr>
      <tr><td>ip (kA peak)</td><td>${(Ik_result * 2.55).toFixed(3)}</td></tr>
      <tr><td>Sk" (MVA)</td><td>${Sk_result.toFixed(2)}</td></tr>
      <tr><td>Base MVA</td><td>${baseMVA}</td></tr>
    </tbody>
  </table>`;

  // Contribution breakdown
  html += `<h4 style="margin-top:20px">Source Contributions</h4>`;
  html += `<table class="results-table"><thead><tr><th>Source</th><th>Type</th><th>Z (p.u.)</th><th>Contribution</th></tr></thead><tbody>`;

  for (const gen of PSS.generators) {
    if (gen.busId === faultBusId || isConnectedTo(gen.id, faultBusId)) {
      const contrib = (1 / gen.xd_pu) / Ztotal_pu_x * 100;
      html += `<tr><td>${gen.name}</td><td>Generator</td><td>${gen.xd_pu.toFixed(4)}</td><td>${contrib.toFixed(1)}%</td></tr>`;
    }
  }
  for (const xfmr of PSS.transformers) {
    if (xfmr.from === faultBusId || xfmr.to === faultBusId) {
      const contrib = (1 / xfmr.zpu) / Ztotal_pu_x * 100;
      html += `<tr><td>${xfmr.name}</td><td>Transformer</td><td>${xfmr.zpu.toFixed(4)}</td><td>${contrib.toFixed(1)}%</td></tr>`;
    }
  }
  for (const motor of PSS.motors) {
    if (motor.busId === faultBusId || isConnectedTo(motor.id, faultBusId)) {
      const motorMVA = motor.prated_kw / 1000 / motor.pf;
      const motorZ = baseMVA / (motorMVA * motor.xlr);
      const contrib = (1 / motorZ) / Ztotal_pu_x * 100;
      html += `<tr><td>${motor.name}</td><td>Motor</td><td>${motorZ.toFixed(4)}</td><td>${contrib.toFixed(1)}%</td></tr>`;
    }
  }

  html += '</tbody></table>';
  document.getElementById('sc-results').innerHTML = html;
}

function isConnectedTo(objId, busId) {
  return PSS.connections.some(c =>
    (c.fromId === objId && c.toId === busId) ||
    (c.toId === objId && c.fromId === busId)
  );
}


/* ════════════════════════════════════════════════════════
   MODULE 4: VOLTAGE DROP & CABLE SIZING
   ════════════════════════════════════════════════════════ */

function initVD() {
  document.getElementById('btn-calc-vd').addEventListener('click', calcVoltageDrop);
  document.getElementById('btn-export-vd').addEventListener('click', () => exportResults('vd'));
}

function calcVoltageDrop() {
  const voltage = parseFloat(document.getElementById('vd-voltage').value);
  const phases = parseInt(document.getElementById('vd-phases').value);
  const current = parseFloat(document.getElementById('vd-current').value);
  const pf = parseFloat(document.getElementById('vd-pf').value);
  const length = parseFloat(document.getElementById('vd-length').value);
  const material = document.getElementById('vd-material').value;
  const size = parseFloat(document.getElementById('vd-size').value);
  const maxDrop = parseFloat(document.getElementById('vd-maxdrop').value);

  // Resistivity (Ω·mm²/m at 75°C)
  const rho = material === 'cu' ? 0.0225 : 0.036;

  // Resistance per km
  const R = rho * 1000 / size; // Ω/km

  // Reactance per km (approximate)
  const X = 0.08; // typical for cables, Ω/km

  const sinPhi = Math.sin(Math.acos(pf));
  const lengthKm = length / 1000;

  let vDrop, vDropPercent;

  if (phases === 3) {
    // Three-phase: ΔV = √3 × I × L × (R·cosφ + X·sinφ)
    vDrop = Math.sqrt(3) * current * lengthKm * (R * pf + X * sinPhi);
    vDropPercent = (vDrop / voltage) * 100;
  } else {
    // Single-phase: ΔV = 2 × I × L × (R·cosφ + X·sinφ)
    vDrop = 2 * current * lengthKm * (R * pf + X * sinPhi);
    vDropPercent = (vDrop / voltage) * 100;
  }

  const vReceiving = voltage - vDrop;

  // Cable ampacity (approximate IEC values)
  const ampacity = getCableAmpacity(size, material);

  // Recommended cable size
  let recommendedSize = null;
  const sizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
  for (const s of sizes) {
    const rS = rho * 1000 / s;
    let vd;
    if (phases === 3) {
      vd = Math.sqrt(3) * current * lengthKm * (rS * pf + X * sinPhi);
    } else {
      vd = 2 * current * lengthKm * (rS * pf + X * sinPhi);
    }
    const vdp = (vd / voltage) * 100;
    const amp = getCableAmpacity(s, material);
    if (vdp <= maxDrop && amp >= current) {
      recommendedSize = s;
      break;
    }
  }

  // Power loss
  const pLoss = (phases === 3 ? 3 : 2) * current * current * R * lengthKm / 1000; // kW

  const statusClass = vDropPercent <= maxDrop ? 'result-ok' : 'result-fail';
  const ampClass = ampacity >= current ? 'result-ok' : 'result-fail';

  let html = `<h4>Results</h4>`;
  html += `<table class="results-table">
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>System</td><td>${phases === 3 ? 'Three Phase' : 'Single Phase'} — ${voltage} V</td></tr>
      <tr><td>Cable</td><td>${size} mm² ${material === 'cu' ? 'Copper' : 'Aluminium'}</td></tr>
      <tr><td>Length</td><td>${length} m</td></tr>
      <tr><td>Load Current</td><td>${current} A (PF = ${pf})</td></tr>
      <tr><td>R (Ω/km)</td><td>${R.toFixed(4)}</td></tr>
      <tr><td>X (Ω/km)</td><td>${X.toFixed(4)}</td></tr>
      <tr><td>Voltage Drop (V)</td><td>${vDrop.toFixed(2)}</td></tr>
      <tr><td>Voltage Drop (%)</td><td class="${statusClass}">${vDropPercent.toFixed(2)}%</td></tr>
      <tr><td>Receiving End Voltage</td><td>${vReceiving.toFixed(2)} V</td></tr>
      <tr><td>Cable Ampacity</td><td class="${ampClass}">${ampacity} A</td></tr>
      <tr><td>Power Loss</td><td>${pLoss.toFixed(3)} kW</td></tr>
      <tr><td>Max Allowed Drop</td><td>${maxDrop}%</td></tr>
      <tr><td>Status</td><td class="${statusClass}">${vDropPercent <= maxDrop ? 'PASS' : 'FAIL — Cable undersized'}</td></tr>
    </tbody>
  </table>`;

  if (recommendedSize && recommendedSize !== size) {
    html += `<p style="margin-top:12px;color:#FFD700;font-size:0.82rem">Recommended minimum cable size: <strong>${recommendedSize} mm²</strong> ${material === 'cu' ? 'Copper' : 'Aluminium'}</p>`;
  }

  // Show all sizes table
  html += `<h4 style="margin-top:20px">Cable Size Comparison</h4>`;
  html += `<table class="results-table"><thead><tr><th>Size (mm²)</th><th>R (Ω/km)</th><th>VD (%)</th><th>Ampacity (A)</th><th>Status</th></tr></thead><tbody>`;
  for (const s of sizes) {
    const rS = rho * 1000 / s;
    let vd;
    if (phases === 3) {
      vd = Math.sqrt(3) * current * lengthKm * (rS * pf + X * sinPhi);
    } else {
      vd = 2 * current * lengthKm * (rS * pf + X * sinPhi);
    }
    const vdp = (vd / voltage) * 100;
    const amp = getCableAmpacity(s, material);
    const pass = vdp <= maxDrop && amp >= current;
    const cls = pass ? 'result-ok' : 'result-fail';
    const highlight = s === size ? ' style="background:rgba(255,215,0,0.08)"' : '';
    html += `<tr${highlight}><td>${s}${s === size ? ' ←' : ''}</td><td>${rS.toFixed(4)}</td><td class="${cls}">${vdp.toFixed(2)}</td><td class="${amp >= current ? 'result-ok' : 'result-fail'}">${amp}</td><td class="${cls}">${pass ? 'OK' : 'FAIL'}</td></tr>`;
  }
  html += '</tbody></table>';

  document.getElementById('vd-results').innerHTML = html;
}

function getCableAmpacity(size, material) {
  // Approximate IEC 60364 ampacity for PVC insulated cables in trefoil
  const cuAmps = {
    1.5: 18, 2.5: 25, 4: 34, 6: 43, 10: 60, 16: 80, 25: 106,
    35: 131, 50: 158, 70: 200, 95: 241, 120: 278, 150: 318,
    185: 362, 240: 424, 300: 486, 400: 570, 500: 660, 630: 775
  };
  const alAmps = {
    1.5: 14, 2.5: 19, 4: 26, 6: 33, 10: 46, 16: 61, 25: 81,
    35: 100, 50: 121, 70: 153, 95: 184, 120: 212, 150: 243,
    185: 277, 240: 324, 300: 371, 400: 435, 500: 504, 630: 592
  };
  return (material === 'cu' ? cuAmps[size] : alAmps[size]) || 0;
}


/* ════════════════════════════════════════════════════════
   MODULE 5: PROTECTION COORDINATION
   ════════════════════════════════════════════════════════ */

function initProtection() {
  document.getElementById('btn-add-device').addEventListener('click', addProtDevice);
  document.getElementById('btn-plot-tcc').addEventListener('click', plotTCC);
  resizeTCCCanvas();
  window.addEventListener('resize', resizeTCCCanvas);
}

function resizeTCCCanvas() {
  const canvas = document.getElementById('tcc-canvas');
  if (!canvas || !canvas.parentElement) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight - 40;
  plotTCC();
}

let protDeviceId = 1;

function addProtDevice() {
  const id = protDeviceId++;
  PSS.protDevices.push({
    id,
    name: 'Relay ' + id,
    type: 'overcurrent', // overcurrent, fuse
    curveType: 'si',     // SI, VI, EI, LTI (IEC curves)
    pickup: 100,         // pickup current (A)
    tms: 0.1,           // time multiplier setting
    ctRatio: 100,       // CT ratio (primary)
    color: getDeviceColor(id),
  });
  renderProtDevices();
}

function getDeviceColor(id) {
  const colors = ['#FFD700', '#4ade80', '#f87171', '#38bdf8', '#a78bfa', '#fb923c'];
  return colors[(id - 1) % colors.length];
}

function removeProtDevice(id) {
  PSS.protDevices = PSS.protDevices.filter(d => d.id !== id);
  renderProtDevices();
  plotTCC();
}

function updateProtDevice(id, key, value) {
  const dev = PSS.protDevices.find(d => d.id === id);
  if (!dev) return;
  if (key === 'name' || key === 'type' || key === 'curveType') {
    dev[key] = value;
  } else {
    dev[key] = parseFloat(value);
  }
  plotTCC();
}

function renderProtDevices() {
  const container = document.getElementById('prot-devices');
  if (PSS.protDevices.length === 0) {
    container.innerHTML = '<h4>Protection Devices</h4><p class="results-empty">Add protection devices to begin coordination</p>';
    return;
  }

  let html = '<h4>Protection Devices</h4>';
  for (const dev of PSS.protDevices) {
    html += `<div class="device-card">
      <h5 style="color:${dev.color}">${dev.name}</h5>
      <div class="form-row">
        <label>Name</label>
        <input type="text" value="${dev.name}" onchange="updateProtDevice(${dev.id},'name',this.value)"/>
      </div>
      <div class="form-row">
        <label>Curve Type (IEC)</label>
        <select onchange="updateProtDevice(${dev.id},'curveType',this.value)">
          <option value="si" ${dev.curveType === 'si' ? 'selected' : ''}>Standard Inverse (SI)</option>
          <option value="vi" ${dev.curveType === 'vi' ? 'selected' : ''}>Very Inverse (VI)</option>
          <option value="ei" ${dev.curveType === 'ei' ? 'selected' : ''}>Extremely Inverse (EI)</option>
          <option value="lti" ${dev.curveType === 'lti' ? 'selected' : ''}>Long Time Inverse (LTI)</option>
        </select>
      </div>
      <div class="form-row">
        <label>Pickup Current (A)</label>
        <input type="number" value="${dev.pickup}" step="any" onchange="updateProtDevice(${dev.id},'pickup',this.value)"/>
      </div>
      <div class="form-row">
        <label>TMS (Time Multiplier)</label>
        <input type="number" value="${dev.tms}" step="0.01" min="0.01" max="1.5" onchange="updateProtDevice(${dev.id},'tms',this.value)"/>
      </div>
      <div class="form-row">
        <label>CT Primary (A)</label>
        <input type="number" value="${dev.ctRatio}" step="any" onchange="updateProtDevice(${dev.id},'ctRatio',this.value)"/>
      </div>
      <button class="device-remove" onclick="removeProtDevice(${dev.id})">Remove</button>
    </div>`;
  }
  container.innerHTML = html;
}

// IEC 60255 curve constants
const IEC_CURVES = {
  si:  { a: 0.14,  b: 0.02  }, // Standard Inverse
  vi:  { a: 13.5,  b: 1.0   }, // Very Inverse
  ei:  { a: 80.0,  b: 2.0   }, // Extremely Inverse
  lti: { a: 120.0, b: 1.0   }, // Long Time Inverse
};

function iecTripTime(curveType, I, Ipickup, tms) {
  const curve = IEC_CURVES[curveType] || IEC_CURVES.si;
  const M = I / Ipickup;
  if (M <= 1) return Infinity;
  return tms * curve.a / (Math.pow(M, curve.b) - 1);
}

function plotTCC() {
  const canvas = document.getElementById('tcc-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Log-log scale
  // X axis: Current (10A to 10000A)
  // Y axis: Time (0.01s to 1000s)
  const xMin = 1, xMax = 4;   // log10(10) to log10(10000)
  const yMin = -2, yMax = 3;  // log10(0.01) to log10(1000)

  const padL = 60, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  function toCanvasX(logI) { return padL + ((logI - xMin) / (xMax - xMin)) * plotW; }
  function toCanvasY(logT) { return padT + ((yMax - logT) / (yMax - yMin)) * plotH; }

  // Background
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let logI = xMin; logI <= xMax; logI += 1) {
    const x = toCanvasX(logI);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    // Sub-grid
    for (let sub = 2; sub <= 9; sub++) {
      const xs = toCanvasX(logI + Math.log10(sub));
      if (xs > padL && xs < padL + plotW) {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath(); ctx.moveTo(xs, padT); ctx.lineTo(xs, padT + plotH); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      }
    }
  }
  for (let logT = yMin; logT <= yMax; logT += 1) {
    const y = toCanvasY(logT);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }

  // Axes labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  for (let logI = xMin; logI <= xMax; logI += 1) {
    ctx.fillText(Math.pow(10, logI).toString(), toCanvasX(logI), padT + plotH + 18);
  }
  ctx.textAlign = 'right';
  for (let logT = yMin; logT <= yMax; logT += 1) {
    ctx.fillText(Math.pow(10, logT).toString() + 's', padL - 6, toCanvasY(logT) + 4);
  }

  // Axis titles
  ctx.fillStyle = '#FFD700';
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Current (A)', padL + plotW / 2, padT + plotH + 35);
  ctx.save();
  ctx.translate(14, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Time (s)', 0, 0);
  ctx.restore();

  // Plot curves
  for (const dev of PSS.protDevices) {
    ctx.strokeStyle = dev.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;

    for (let logI = xMin; logI <= xMax; logI += 0.02) {
      const I = Math.pow(10, logI);
      const t = iecTripTime(dev.curveType, I, dev.pickup, dev.tms);
      if (t === Infinity || t > 10000 || t < 0.001) continue;
      const logT = Math.log10(t);
      if (logT < yMin || logT > yMax) continue;

      const cx = toCanvasX(logI);
      const cy = toCanvasY(logT);
      if (!started) { ctx.moveTo(cx, cy); started = true; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Label
    if (started) {
      const labelI = dev.pickup * 5;
      const labelT = iecTripTime(dev.curveType, labelI, dev.pickup, dev.tms);
      if (labelT !== Infinity && labelT > 0) {
        const lx = toCanvasX(Math.log10(labelI));
        const ly = toCanvasY(Math.log10(labelT));
        ctx.fillStyle = dev.color;
        ctx.font = 'bold 10px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(dev.name, lx + 6, ly - 4);
      }
    }
  }

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, plotW, plotH);
}


/* ════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════ */

function exportResults(module) {
  let content = '';
  let el;
  switch (module) {
    case 'pf': el = document.getElementById('pf-results'); break;
    case 'sc': el = document.getElementById('sc-results'); break;
    case 'vd': el = document.getElementById('vd-results'); break;
  }
  if (!el) return;

  // Extract table data as CSV
  const tables = el.querySelectorAll('table');
  if (tables.length === 0) { toast('No results to export.'); return; }

  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('th, td');
      content += Array.from(cells).map(c => '"' + c.textContent.trim() + '"').join(',') + '\n';
    }
    content += '\n';
  }

  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KIT_${module.toUpperCase()}_results.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Results exported as CSV.');
}

// Make functions globally available
window.initSimulator = initSimulator;
window.openSimulator = openSimulator;
window.updateProp = updateProp;
window.updateProtDevice = updateProtDevice;
window.removeProtDevice = removeProtDevice;
window.rotateSelected = rotateSelected;
