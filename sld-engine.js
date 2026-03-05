/**
 * sld-engine.js — Core engine for the KIT Single Line Diagram editor.
 *
 * Features:
 *   - Infinite pan/zoom canvas (mouse wheel, middle-drag, keyboard arrows)
 *   - Drag-and-drop from palette onto canvas
 *   - Component selection, move, delete
 *   - Port-based connection system with orthogonal wire routing
 *   - Properties panel binding
 *   - Minimap navigation
 *   - Snap-to-grid
 *   - Label text alignment per component
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════ */

const state = {
  components: [],       // placed components
  wires: [],            // connections between ports
  nextId: 1,            // auto-increment id
  selected: null,       // selected component id
  selectedWire: null,   // selected wire index

  // Canvas transform
  panX: -4600,
  panY: -4600,
  zoom: 1,
  minZoom: 0.15,
  maxZoom: 3,

  // Interaction modes
  mode: 'pointer',      // 'pointer' | 'connect'
  showGrid: true,
  snapToGrid: true,
  gridSize: 20,

  // Drag state
  dragging: null,       // { compId, offsetX, offsetY }
  panning: false,
  panStart: null,

  // Connection-in-progress
  connecting: null,     // { fromCompId, fromPortId, x0, y0 }
};

/* ═══════════════════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════════════════ */

const $wrap      = document.getElementById('canvas-wrap');
const $canvas    = document.getElementById('sld-canvas');
const $compLayer = document.getElementById('sld-components');
const $wiresSvg  = document.getElementById('sld-wires');
const $coords    = document.getElementById('sld-coords');
const $zoomLabel = document.getElementById('zoom-label');
const $minimap   = document.getElementById('minimap-canvas');
const $mmVP      = document.getElementById('minimap-viewport');
const $tooltip   = document.getElementById('port-tooltip');

// Properties panel
const $propsEmpty   = document.getElementById('props-empty');
const $propsContent = document.getElementById('props-content');
const $propName     = document.getElementById('prop-name');
const $propType     = document.getElementById('prop-type');
const $propLabelPos = document.getElementById('prop-label-pos');
const $propLabelAlign = document.getElementById('prop-label-align');
const $propRating   = document.getElementById('prop-rating');
const $propVoltage  = document.getElementById('prop-voltage');
const $propRatingG  = document.getElementById('prop-rating-group');
const $propVoltageG = document.getElementById('prop-voltage-group');
const $propCTGroup  = document.getElementById('prop-relay-ct-group');
const $propCTList   = document.getElementById('prop-ct-list');
const $propCTHint   = document.getElementById('prop-ct-hint');
const $propConns    = document.getElementById('prop-connections');

/* ═══════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════ */

(function init() {
  renderPaletteIcons();
  applyTransform();
  bindToolbar();
  bindCanvasEvents();
  bindPaletteEvents();
  bindPropertiesEvents();
  bindKeyboard();
  requestAnimationFrame(updateMinimap);
})();

/* ═══════════════════════════════════════════════════════
   TRANSFORM / VIEW
   ═══════════════════════════════════════════════════════ */

function applyTransform() {
  $canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  $zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
  if (state.showGrid) {
    $canvas.classList.remove('no-grid');
  } else {
    $canvas.classList.add('no-grid');
  }
}

function screenToCanvas(sx, sy) {
  const rect = $wrap.getBoundingClientRect();
  return {
    x: (sx - rect.left - state.panX) / state.zoom,
    y: (sy - rect.top  - state.panY) / state.zoom,
  };
}

function snap(val) {
  return state.snapToGrid ? Math.round(val / state.gridSize) * state.gridSize : val;
}

/* ═══════════════════════════════════════════════════════
   TOOLBAR
   ═══════════════════════════════════════════════════════ */

function bindToolbar() {
  document.getElementById('btn-pointer').addEventListener('click', () => setMode('pointer'));
  document.getElementById('btn-connect').addEventListener('click', () => setMode('connect'));
  document.getElementById('btn-grid').addEventListener('click', toggleGrid);
  document.getElementById('btn-snap').addEventListener('click', toggleSnap);
  document.getElementById('btn-zoom-in').addEventListener('click', () => zoomBy(0.15));
  document.getElementById('btn-zoom-out').addEventListener('click', () => zoomBy(-0.15));
  document.getElementById('btn-zoom-fit').addEventListener('click', fitView);
  document.getElementById('btn-delete').addEventListener('click', deleteSelected);
  document.getElementById('btn-clear').addEventListener('click', clearAll);
}

function setMode(mode) {
  state.mode = mode;
  document.getElementById('btn-pointer').dataset.active = mode === 'pointer';
  document.getElementById('btn-connect').dataset.active = mode === 'connect';
  $wrap.classList.toggle('connecting', mode === 'connect');
  cancelConnection();
}

function toggleGrid() {
  state.showGrid = !state.showGrid;
  document.getElementById('btn-grid').dataset.active = state.showGrid;
  applyTransform();
}

function toggleSnap() {
  state.snapToGrid = !state.snapToGrid;
  document.getElementById('btn-snap').dataset.active = state.snapToGrid;
}

function zoomBy(delta, cx, cy) {
  const rect = $wrap.getBoundingClientRect();
  if (cx === undefined) { cx = rect.width / 2; cy = rect.height / 2; }
  const oldZ = state.zoom;
  state.zoom = Math.max(state.minZoom, Math.min(state.maxZoom, state.zoom + delta));
  const factor = state.zoom / oldZ;
  state.panX = cx - factor * (cx - state.panX);
  state.panY = cy - factor * (cy - state.panY);
  applyTransform();
}

function fitView() {
  if (state.components.length === 0) {
    state.panX = -4600;
    state.panY = -4600;
    state.zoom = 1;
    applyTransform();
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of state.components) {
    const def = SLD_COMP[c.type];
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + def.w);
    maxY = Math.max(maxY, c.y + def.h);
  }
  const pad = 80;
  const rect = $wrap.getBoundingClientRect();
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  state.zoom = Math.min(rect.width / w, rect.height / h, 2);
  state.panX = -((minX - pad) * state.zoom - (rect.width  - w * state.zoom) / 2);
  state.panY = -((minY - pad) * state.zoom - (rect.height - h * state.zoom) / 2);
  applyTransform();
}

/* ═══════════════════════════════════════════════════════
   CANVAS EVENTS: PAN, ZOOM, CLICK
   ═══════════════════════════════════════════════════════ */

function bindCanvasEvents() {
  // Wheel zoom
  $wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = $wrap.getBoundingClientRect();
    const delta = -e.deltaY * 0.001;
    zoomBy(delta, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  // Pan with middle mouse or space-held left mouse
  $wrap.addEventListener('mousedown', e => {
    // Middle button pan
    if (e.button === 1) {
      e.preventDefault();
      startPan(e);
      return;
    }
    // Left click on empty canvas
    if (e.button === 0 && e.target === $canvas) {
      // If connecting, cancel
      if (state.connecting) {
        cancelConnection();
      }
      selectComponent(null);
      selectWire(null);
    }
  });

  $wrap.addEventListener('mousemove', e => {
    if (state.panning) {
      state.panX += e.clientX - state.panStart.x;
      state.panY += e.clientY - state.panStart.y;
      state.panStart = { x: e.clientX, y: e.clientY };
      applyTransform();
      return;
    }
    if (state.dragging) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const comp = getComp(state.dragging.compId);
      if (comp) {
        comp.x = snap(pos.x - state.dragging.offsetX);
        comp.y = snap(pos.y - state.dragging.offsetY);
        renderComponent(comp);
        renderAllWires();
      }
      return;
    }
    if (state.connecting) {
      updateConnectionPreview(e.clientX, e.clientY);
    }
    // Update coords
    const pos = screenToCanvas(e.clientX, e.clientY);
    $coords.textContent = `X: ${Math.round(pos.x)}  Y: ${Math.round(pos.y)}`;
  });

  $wrap.addEventListener('mouseup', e => {
    if (state.panning) {
      state.panning = false;
      $wrap.classList.remove('panning');
    }
    if (state.dragging) {
      state.dragging = null;
    }
  });

  // Also handle mouse leaving the window
  window.addEventListener('mouseup', () => {
    state.panning = false;
    state.dragging = null;
    $wrap.classList.remove('panning');
  });

  // Click on canvas (deselect)
  $canvas.addEventListener('click', e => {
    if (e.target === $canvas || e.target === $compLayer) {
      selectComponent(null);
      selectWire(null);
    }
  });
}

function startPan(e) {
  state.panning = true;
  state.panStart = { x: e.clientX, y: e.clientY };
  $wrap.classList.add('panning');
}

/* ═══════════════════════════════════════════════════════
   KEYBOARD
   ═══════════════════════════════════════════════════════ */

let spaceHeld = false;

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    // Don't intercept when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        deleteSelected();
        break;
      case 'v': setMode('pointer'); break;
      case 'c': setMode('connect'); break;
      case 'g': toggleGrid(); break;
      case 's': toggleSnap(); break;
      case 'f': fitView(); break;
      case '+': case '=': zoomBy(0.15); break;
      case '-': zoomBy(-0.15); break;
      case 'Escape':
        cancelConnection();
        selectComponent(null);
        selectWire(null);
        break;
      case ' ':
        if (!spaceHeld) {
          spaceHeld = true;
          $wrap.classList.add('panning');
          // Space-pan: listen for mouse down
          const onMD = ev => {
            if (ev.button === 0) startPan(ev);
          };
          $wrap.addEventListener('mousedown', onMD);
          const cleanup = () => {
            spaceHeld = false;
            $wrap.classList.remove('panning');
            $wrap.removeEventListener('mousedown', onMD);
          };
          document.addEventListener('keyup', function onKU(ev) {
            if (ev.key === ' ') {
              cleanup();
              document.removeEventListener('keyup', onKU);
            }
          });
        }
        e.preventDefault();
        break;
      case 'ArrowUp':    state.panY += 60; applyTransform(); e.preventDefault(); break;
      case 'ArrowDown':  state.panY -= 60; applyTransform(); e.preventDefault(); break;
      case 'ArrowLeft':  state.panX += 60; applyTransform(); e.preventDefault(); break;
      case 'ArrowRight': state.panX -= 60; applyTransform(); e.preventDefault(); break;
    }
  });
}

/* ═══════════════════════════════════════════════════════
   PALETTE: DRAG-AND-DROP
   ═══════════════════════════════════════════════════════ */

function bindPaletteEvents() {
  const items = document.querySelectorAll('.palette-item');
  items.forEach(item => {
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', item.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
      // Drag image
      const preview = document.createElement('div');
      preview.className = 'drag-preview';
      const def = SLD_COMP[item.dataset.type];
      if (def) preview.innerHTML = def.svg();
      document.body.appendChild(preview);
      e.dataTransfer.setDragImage(preview, def ? def.w / 2 : 20, def ? def.h / 2 : 20);
      setTimeout(() => preview.remove(), 0);
    });
  });

  $wrap.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  $wrap.addEventListener('drop', e => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type || !SLD_COMP[type]) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    const def = SLD_COMP[type];
    addComponent(type, snap(pos.x - def.w / 2), snap(pos.y - def.h / 2));
  });
}

/* ═══════════════════════════════════════════════════════
   COMPONENT MANAGEMENT
   ═══════════════════════════════════════════════════════ */

function addComponent(type, x, y) {
  const def = SLD_COMP[type];
  if (!def) return;
  const id = state.nextId++;
  const comp = {
    id,
    type,
    name: `${def.label} ${id}`,
    x, y,
    labelPos: 'top',
    labelAlign: 'center',
    props: { ...def.defaults },
  };
  state.components.push(comp);
  createComponentDOM(comp);
  selectComponent(id);
  return comp;
}

function getComp(id) {
  return state.components.find(c => c.id === id);
}

function createComponentDOM(comp) {
  const def = SLD_COMP[comp.type];
  const el = document.createElement('div');
  el.className = 'sld-comp';
  el.dataset.id = comp.id;
  el.style.left = comp.x + 'px';
  el.style.top  = comp.y + 'px';
  el.style.width  = def.w + 'px';
  el.style.height = def.h + 'px';

  // SVG body
  const body = document.createElement('div');
  body.className = 'comp-body';
  body.innerHTML = def.svg();
  el.appendChild(body);

  // Label
  const label = document.createElement('div');
  label.className = `comp-label pos-${comp.labelPos} align-${comp.labelAlign}`;
  label.innerHTML = `<span class="comp-label-name">${comp.name}</span>`;
  if (comp.props.voltage) {
    label.innerHTML += `<span class="comp-sublabel">${comp.props.voltage} kV</span>`;
  } else if (comp.props.rating) {
    label.innerHTML += `<span class="comp-sublabel">${comp.props.rating}</span>`;
  } else if (comp.props.ratio) {
    label.innerHTML += `<span class="comp-sublabel">${comp.props.ratio}</span>`;
  }
  el.appendChild(label);

  // Ports
  for (const port of def.ports) {
    const portEl = document.createElement('div');
    portEl.className = `comp-port port-${port.dir}`;
    portEl.dataset.portId = port.id;
    portEl.dataset.compId = comp.id;
    portEl.style.left = port.x + 'px';
    portEl.style.top  = port.y + 'px';
    portEl.title = port.label;

    // Port events
    portEl.addEventListener('mouseenter', e => showPortTooltip(e, port, comp));
    portEl.addEventListener('mouseleave', hidePortTooltip);
    portEl.addEventListener('mousedown', e => {
      e.stopPropagation();
      if (state.mode === 'connect' || e.shiftKey) {
        startConnection(comp.id, port.id, e);
      }
    });
    portEl.addEventListener('mouseup', e => {
      e.stopPropagation();
      if (state.connecting) {
        finishConnection(comp.id, port.id);
      }
    });

    el.appendChild(portEl);
  }

  // Component mouse events
  el.addEventListener('mousedown', e => {
    if (e.target.classList.contains('comp-port')) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    selectComponent(comp.id);
    // Start drag
    const pos = screenToCanvas(e.clientX, e.clientY);
    state.dragging = {
      compId: comp.id,
      offsetX: pos.x - comp.x,
      offsetY: pos.y - comp.y,
    };
  });

  $compLayer.appendChild(el);
}

function renderComponent(comp) {
  const el = $compLayer.querySelector(`[data-id="${comp.id}"]`);
  if (!el) return;
  const def = SLD_COMP[comp.type];
  el.style.left = comp.x + 'px';
  el.style.top  = comp.y + 'px';

  // Update label
  const label = el.querySelector('.comp-label');
  if (label) {
    label.className = `comp-label pos-${comp.labelPos} align-${comp.labelAlign}`;
    let html = `<span class="comp-label-name">${comp.name}</span>`;
    if (comp.props.voltage) {
      html += `<span class="comp-sublabel">${comp.props.voltage} kV</span>`;
    } else if (comp.props.rating) {
      html += `<span class="comp-sublabel">${comp.props.rating}</span>`;
    } else if (comp.props.ratio) {
      html += `<span class="comp-sublabel">${comp.props.ratio}</span>`;
    }
    label.innerHTML = html;
  }

  // Update port connected status
  for (const portEl of el.querySelectorAll('.comp-port')) {
    const pid = portEl.dataset.portId;
    const isConn = state.wires.some(w =>
      (w.from.compId === comp.id && w.from.portId === pid) ||
      (w.to.compId === comp.id && w.to.portId === pid)
    );
    portEl.classList.toggle('connected', isConn);
  }
}

function selectComponent(id) {
  state.selected = id;
  state.selectedWire = null;
  // Update DOM selection
  $compLayer.querySelectorAll('.sld-comp').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.id) === id);
  });
  // Update properties panel
  updatePropertiesPanel();
}

function selectWire(idx) {
  state.selectedWire = idx;
  state.selected = null;
  $compLayer.querySelectorAll('.sld-comp').forEach(el => el.classList.remove('selected'));
  renderAllWires();
  if (idx === null) updatePropertiesPanel();
}

function deleteSelected() {
  if (state.selected !== null) {
    const id = state.selected;
    // Remove wires connected to this component
    state.wires = state.wires.filter(w => w.from.compId !== id && w.to.compId !== id);
    // Remove component
    state.components = state.components.filter(c => c.id !== id);
    const el = $compLayer.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
    state.selected = null;
    renderAllWires();
    updatePropertiesPanel();
  } else if (state.selectedWire !== null) {
    state.wires.splice(state.selectedWire, 1);
    state.selectedWire = null;
    renderAllWires();
    // Update port visuals
    state.components.forEach(c => renderComponent(c));
  }
}

function clearAll() {
  if (state.components.length === 0 && state.wires.length === 0) return;
  state.components = [];
  state.wires = [];
  state.selected = null;
  state.selectedWire = null;
  state.nextId = 1;
  $compLayer.innerHTML = '';
  renderAllWires();
  updatePropertiesPanel();
}

/* ═══════════════════════════════════════════════════════
   CONNECTION / WIRE SYSTEM
   ═══════════════════════════════════════════════════════ */

function getPortWorldPos(compId, portId) {
  const comp = getComp(compId);
  if (!comp) return null;
  const def = SLD_COMP[comp.type];
  const port = def.ports.find(p => p.id === portId);
  if (!port) return null;
  return { x: comp.x + port.x, y: comp.y + port.y };
}

function startConnection(compId, portId, e) {
  const pos = getPortWorldPos(compId, portId);
  if (!pos) return;
  state.connecting = { fromCompId: compId, fromPortId: portId, x0: pos.x, y0: pos.y };
  // Create preview line
  let preview = $wiresSvg.querySelector('.wire-preview');
  if (!preview) {
    preview = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    preview.classList.add('wire-preview');
    $wiresSvg.appendChild(preview);
  }
  updateConnectionPreview(e.clientX, e.clientY);

  // Highlight compatible ports
  highlightCompatiblePorts(compId, portId);
}

function updateConnectionPreview(clientX, clientY) {
  if (!state.connecting) return;
  const preview = $wiresSvg.querySelector('.wire-preview');
  if (!preview) return;
  const pos = screenToCanvas(clientX, clientY);
  const pts = routeWire(state.connecting.x0, state.connecting.y0, pos.x, pos.y);
  preview.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
}

function finishConnection(toCompId, toPortId) {
  if (!state.connecting) return;
  const { fromCompId, fromPortId } = state.connecting;

  // Can't connect to self
  if (fromCompId === toCompId && fromPortId === toPortId) {
    cancelConnection();
    return;
  }

  // Check if wire already exists
  const exists = state.wires.some(w =>
    (w.from.compId === fromCompId && w.from.portId === fromPortId &&
     w.to.compId === toCompId && w.to.portId === toPortId) ||
    (w.from.compId === toCompId && w.from.portId === toPortId &&
     w.to.compId === fromCompId && w.to.portId === fromPortId)
  );

  if (!exists) {
    state.wires.push({
      from: { compId: fromCompId, portId: fromPortId },
      to:   { compId: toCompId,   portId: toPortId },
    });
    // Update port visuals
    renderComponent(getComp(fromCompId));
    renderComponent(getComp(toCompId));
  }

  cancelConnection();
  renderAllWires();
}

function cancelConnection() {
  state.connecting = null;
  const preview = $wiresSvg.querySelector('.wire-preview');
  if (preview) preview.remove();
  // Remove port highlights
  $compLayer.querySelectorAll('.comp-port.highlight').forEach(p => p.classList.remove('highlight'));
}

function highlightCompatiblePorts(excludeCompId, excludePortId) {
  // Highlight all ports except the one we started from
  $compLayer.querySelectorAll('.comp-port').forEach(p => {
    const cId = parseInt(p.dataset.compId);
    const pId = p.dataset.portId;
    if (cId === excludeCompId && pId === excludePortId) return;
    p.classList.add('highlight');
  });
}

/* ── Orthogonal wire routing ─────────────────────────── */

function routeWire(x1, y1, x2, y2) {
  // Simple orthogonal routing: go vertical to midpoint, then horizontal, then vertical
  const midY = (y1 + y2) / 2;
  if (Math.abs(x1 - x2) < 2) {
    // Vertical alignment — straight line
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }
  if (Math.abs(y1 - y2) < 2) {
    // Horizontal alignment — straight line
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }
  return [
    { x: x1, y: y1 },
    { x: x1, y: midY },
    { x: x2, y: midY },
    { x: x2, y: y2 },
  ];
}

function renderAllWires() {
  // Clear existing wires (except preview)
  const preview = $wiresSvg.querySelector('.wire-preview');
  $wiresSvg.innerHTML = '';
  if (preview) $wiresSvg.appendChild(preview);

  state.wires.forEach((wire, idx) => {
    const from = getPortWorldPos(wire.from.compId, wire.from.portId);
    const to   = getPortWorldPos(wire.to.compId, wire.to.portId);
    if (!from || !to) return;

    const pts = routeWire(from.x, from.y, to.x, to.y);
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.classList.add('wire');
    if (state.selectedWire === idx) polyline.classList.add('selected');
    polyline.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
    polyline.addEventListener('click', e => {
      e.stopPropagation();
      selectWire(idx);
    });
    $wiresSvg.appendChild(polyline);
  });
}

/* ═══════════════════════════════════════════════════════
   PORT TOOLTIP
   ═══════════════════════════════════════════════════════ */

function showPortTooltip(e, port, comp) {
  const def = SLD_COMP[comp.type];
  let text = `${port.label}`;
  if (port.dir === 'in')  text += ' (incoming)';
  if (port.dir === 'out') text += ' (outgoing)';
  if (port.dir === 'io')  text += ' (bidirectional)';
  $tooltip.textContent = text;
  $tooltip.style.display = 'block';
  $tooltip.style.left = (e.clientX + 12) + 'px';
  $tooltip.style.top  = (e.clientY - 8) + 'px';
}

function hidePortTooltip() {
  $tooltip.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════
   PROPERTIES PANEL
   ═══════════════════════════════════════════════════════ */

function bindPropertiesEvents() {
  $propName.addEventListener('change', () => {
    const comp = getComp(state.selected);
    if (comp) { comp.name = $propName.value; renderComponent(comp); }
  });

  $propLabelPos.addEventListener('change', () => {
    const comp = getComp(state.selected);
    if (comp) { comp.labelPos = $propLabelPos.value; renderComponent(comp); }
  });

  $propLabelAlign.addEventListener('change', () => {
    const comp = getComp(state.selected);
    if (comp) { comp.labelAlign = $propLabelAlign.value; renderComponent(comp); }
  });

  $propRating.addEventListener('change', () => {
    const comp = getComp(state.selected);
    if (comp) { comp.props.rating = $propRating.value; renderComponent(comp); }
  });

  $propVoltage.addEventListener('change', () => {
    const comp = getComp(state.selected);
    if (comp) { comp.props.voltage = $propVoltage.value; renderComponent(comp); }
  });
}

function updatePropertiesPanel() {
  const comp = getComp(state.selected);
  if (!comp) {
    $propsEmpty.style.display = '';
    $propsContent.style.display = 'none';
    return;
  }

  $propsEmpty.style.display = 'none';
  $propsContent.style.display = '';

  const def = SLD_COMP[comp.type];

  $propName.value  = comp.name;
  $propType.value  = def.label + ' (' + comp.type + ')';
  $propLabelPos.value   = comp.labelPos;
  $propLabelAlign.value = comp.labelAlign;

  // Voltage
  if (comp.props.voltage !== undefined) {
    $propVoltageG.style.display = '';
    $propVoltage.value = comp.props.voltage || '';
  } else {
    $propVoltageG.style.display = 'none';
  }

  // Rating
  if (comp.props.rating !== undefined) {
    $propRatingG.style.display = '';
    $propRating.value = comp.props.rating || '';
  } else if (comp.props.ratio !== undefined) {
    $propRatingG.style.display = '';
    $propRating.parentElement.querySelector('.prop-label').textContent = 'Ratio';
    $propRating.value = comp.props.ratio || '';
  } else {
    $propRatingG.style.display = 'none';
  }

  // Relay CT requirements
  if (def.requiredCT) {
    $propCTGroup.style.display = '';
    const connectedCTs = findConnectedCTs(comp);
    $propCTList.innerHTML = '';
    if (connectedCTs.length === 0) {
      $propCTList.innerHTML = '<span style="color:var(--text-dim);font-size:11px;">No CTs connected</span>';
    } else {
      connectedCTs.forEach(ct => {
        const div = document.createElement('div');
        div.className = 'prop-ct-item';
        div.innerHTML = `<span class="ct-dot"></span> ${ct.name} (${ct.props.ratio || 'N/A'})`;
        $propCTList.appendChild(div);
      });
    }
    const needed = def.requiredCT;
    const have = connectedCTs.length;
    if (have < needed) {
      $propCTHint.textContent = `Requires ${needed}+ CT inputs. Currently ${have} connected.`;
      $propCTHint.style.color = 'var(--red)';
    } else {
      $propCTHint.textContent = `${have} CT(s) connected. Requirement met.`;
      $propCTHint.style.color = 'var(--green)';
    }
  } else {
    $propCTGroup.style.display = 'none';
  }

  // Show connections
  $propConns.innerHTML = '';
  const wires = state.wires.filter(w =>
    w.from.compId === comp.id || w.to.compId === comp.id
  );
  if (wires.length === 0) {
    $propConns.innerHTML = '<span style="color:var(--text-dim);font-size:11px;">No connections</span>';
  } else {
    wires.forEach(w => {
      const isFrom = w.from.compId === comp.id;
      const otherComp = getComp(isFrom ? w.to.compId : w.from.compId);
      if (!otherComp) return;
      const myPort = isFrom ? w.from.portId : w.to.portId;
      const otherPort = isFrom ? w.to.portId : w.from.portId;
      const div = document.createElement('div');
      div.className = 'prop-conn-item';
      div.innerHTML = `<span class="conn-arrow">${isFrom ? '→' : '←'}</span> ${myPort} ${isFrom ? '→' : '←'} ${otherComp.name}.${otherPort}`;
      $propConns.appendChild(div);
    });
  }
}

function findConnectedCTs(relayComp) {
  // Find CT components connected to this relay's CT input ports
  const cts = [];
  const def = SLD_COMP[relayComp.type];
  const ctPorts = def.ports.filter(p => p.id.startsWith('ct_in'));

  for (const port of ctPorts) {
    for (const wire of state.wires) {
      let otherCompId = null;
      if (wire.to.compId === relayComp.id && wire.to.portId === port.id) {
        otherCompId = wire.from.compId;
      } else if (wire.from.compId === relayComp.id && wire.from.portId === port.id) {
        otherCompId = wire.to.compId;
      }
      if (otherCompId) {
        const otherComp = getComp(otherCompId);
        if (otherComp && otherComp.type === 'ct') {
          cts.push(otherComp);
        }
      }
    }
  }
  return cts;
}

/* ═══════════════════════════════════════════════════════
   MINIMAP
   ═══════════════════════════════════════════════════════ */

function updateMinimap() {
  const ctx = $minimap.getContext('2d');
  const mw = $minimap.width;
  const mh = $minimap.height;
  ctx.clearRect(0, 0, mw, mh);

  // Background
  ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
  ctx.fillRect(0, 0, mw, mh);

  if (state.components.length === 0) {
    requestAnimationFrame(updateMinimap);
    return;
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of state.components) {
    const def = SLD_COMP[c.type];
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + def.w);
    maxY = Math.max(maxY, c.y + def.h);
  }

  const pad = 100;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const scaleX = mw / (maxX - minX);
  const scaleY = mh / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  const ox = (mw - (maxX - minX) * scale) / 2;
  const oy = (mh - (maxY - minY) * scale) / 2;

  // Draw wires
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 1;
  for (const wire of state.wires) {
    const from = getPortWorldPos(wire.from.compId, wire.from.portId);
    const to   = getPortWorldPos(wire.to.compId, wire.to.portId);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.moveTo(ox + (from.x - minX) * scale, oy + (from.y - minY) * scale);
    ctx.lineTo(ox + (to.x - minX) * scale, oy + (to.y - minY) * scale);
    ctx.stroke();
  }

  // Draw components as dots
  for (const c of state.components) {
    const def = SLD_COMP[c.type];
    const cx = ox + (c.x + def.w / 2 - minX) * scale;
    const cy = oy + (c.y + def.h / 2 - minY) * scale;
    ctx.fillStyle = c.id === state.selected ? '#ffd700' : '#4f8cff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Viewport rectangle
  const rect = $wrap.getBoundingClientRect();
  const vpLeft   = (-state.panX / state.zoom - minX) * scale + ox;
  const vpTop    = (-state.panY / state.zoom - minY) * scale + oy;
  const vpWidth  = (rect.width  / state.zoom) * scale;
  const vpHeight = (rect.height / state.zoom) * scale;

  $mmVP.style.left   = Math.max(0, vpLeft) + 'px';
  $mmVP.style.top    = Math.max(0, vpTop) + 'px';
  $mmVP.style.width  = Math.min(mw, vpWidth) + 'px';
  $mmVP.style.height = Math.min(mh, vpHeight) + 'px';

  requestAnimationFrame(updateMinimap);
}
