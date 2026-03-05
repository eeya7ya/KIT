/**
 * sld-components.js — Electrical component definitions for the SLD editor.
 *
 * Each component definition specifies:
 *   - type, label, category
 *   - width / height (bounding box for the SVG)
 *   - ports[] — connection points { id, x, y, dir ('in'|'out'|'io'), label }
 *   - svg() — returns the inner SVG markup
 *   - defaults — default property values
 *
 * Realistic relay modelling:
 *   Differential (87) requires 2+ CT inputs.
 *   Overcurrent (50/51) requires 1 CT input.
 *   Distance (21) requires 1 CT + 1 VT input.
 */

'use strict';

const SLD_COMP = {};

/* ── Helper: generate SVG defs for relay arcs etc. ─── */
function relayBox(w, h, code, color) {
  return `
    <rect x="0" y="0" width="${w}" height="${h}" rx="4"
          stroke="${color}" stroke-width="2" fill="rgba(0,0,0,0.4)"
          stroke-dasharray="6 3"/>
    <text x="${w / 2}" y="${h / 2 + 4}" text-anchor="middle"
          fill="${color}" font-size="13" font-weight="700">${code}</text>`;
}

/* ═══════════════════════════════════════════════════════
   POWER SOURCES
   ═══════════════════════════════════════════════════════ */

SLD_COMP.utility = {
  type: 'utility',
  label: 'Utility',
  category: 'Power Sources',
  w: 50, h: 50,
  ports: [
    { id: 'out', x: 25, y: 50, dir: 'out', label: 'Output' },
  ],
  svg() {
    return `<svg width="50" height="50" viewBox="0 0 50 50">
      <polygon points="10,0 40,0 50,20 40,40 10,40 0,20" class="stroke-green" fill="none" stroke-width="2"/>
      <text x="25" y="24" text-anchor="middle" fill="#00e676" font-size="14" font-weight="700">~</text>
    </svg>`;
  },
  defaults: { voltage: '132', rating: '' },
};

SLD_COMP.generator = {
  type: 'generator',
  label: 'Gen',
  category: 'Power Sources',
  w: 44, h: 44,
  ports: [
    { id: 'out', x: 22, y: 44, dir: 'out', label: 'Terminal' },
  ],
  svg() {
    return `<svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" class="stroke-green" stroke-width="2" fill="rgba(0,0,0,0.3)"/>
      <text x="22" y="27" text-anchor="middle" fill="#00e676" font-size="16" font-weight="700">G</text>
    </svg>`;
  },
  defaults: { voltage: '11', rating: '100 MVA' },
};

/* ═══════════════════════════════════════════════════════
   CONDUCTORS
   ═══════════════════════════════════════════════════════ */

SLD_COMP.bus = {
  type: 'bus',
  label: 'Bus',
  category: 'Conductors',
  w: 120, h: 8,
  ports: [
    { id: 'left',  x: 0,   y: 4, dir: 'io', label: 'Left' },
    { id: 'right', x: 120, y: 4, dir: 'io', label: 'Right' },
    { id: 'top1',  x: 30,  y: 0, dir: 'in', label: 'Incoming 1' },
    { id: 'top2',  x: 60,  y: 0, dir: 'in', label: 'Incoming 2' },
    { id: 'top3',  x: 90,  y: 0, dir: 'in', label: 'Incoming 3' },
    { id: 'bot1',  x: 30,  y: 8, dir: 'out', label: 'Outgoing 1' },
    { id: 'bot2',  x: 60,  y: 8, dir: 'out', label: 'Outgoing 2' },
    { id: 'bot3',  x: 90,  y: 8, dir: 'out', label: 'Outgoing 3' },
  ],
  svg() {
    return `<svg width="120" height="8" viewBox="0 0 120 8">
      <rect x="0" y="1" width="120" height="6" rx="1" fill="#c8d6e5"/>
    </svg>`;
  },
  defaults: { voltage: '11' },
};

SLD_COMP.line = {
  type: 'line',
  label: 'Line',
  category: 'Conductors',
  w: 20, h: 80,
  ports: [
    { id: 'in',  x: 10, y: 0,  dir: 'in',  label: 'From' },
    { id: 'out', x: 10, y: 80, dir: 'out', label: 'To' },
  ],
  svg() {
    return `<svg width="20" height="80" viewBox="0 0 20 80">
      <line x1="10" y1="0" x2="10" y2="80" class="stroke-main" stroke-width="2"/>
      <line x1="6" y1="20" x2="14" y2="20" stroke="#5a6a7e" stroke-width="1"/>
      <line x1="6" y1="40" x2="14" y2="40" stroke="#5a6a7e" stroke-width="1"/>
      <line x1="6" y1="60" x2="14" y2="60" stroke="#5a6a7e" stroke-width="1"/>
    </svg>`;
  },
  defaults: { voltage: '132', rating: '100 km' },
};

SLD_COMP.cable = {
  type: 'cable',
  label: 'Cable',
  category: 'Conductors',
  w: 20, h: 60,
  ports: [
    { id: 'in',  x: 10, y: 0,  dir: 'in',  label: 'From' },
    { id: 'out', x: 10, y: 60, dir: 'out', label: 'To' },
  ],
  svg() {
    return `<svg width="20" height="60" viewBox="0 0 20 60">
      <line x1="10" y1="0" x2="10" y2="60" class="stroke-main" stroke-width="2" stroke-dasharray="6 3"/>
      <circle cx="10" cy="0" r="3" fill="#c8d6e5"/>
      <circle cx="10" cy="60" r="3" fill="#c8d6e5"/>
    </svg>`;
  },
  defaults: { voltage: '11', rating: '95 mm² / 0.5 km' },
};

/* ═══════════════════════════════════════════════════════
   TRANSFORMERS
   ═══════════════════════════════════════════════════════ */

SLD_COMP.transformer2w = {
  type: 'transformer2w',
  label: 'Xfmr',
  category: 'Transformers',
  w: 44, h: 56,
  ports: [
    { id: 'hv', x: 22, y: 0,  dir: 'in',  label: 'HV Side' },
    { id: 'lv', x: 22, y: 56, dir: 'out', label: 'LV Side' },
  ],
  svg() {
    return `<svg width="44" height="56" viewBox="0 0 44 56">
      <circle cx="22" cy="18" r="16" class="stroke-magenta" stroke-width="2" fill="none"/>
      <circle cx="22" cy="38" r="16" class="stroke-magenta" stroke-width="2" fill="none"/>
    </svg>`;
  },
  defaults: { voltage: '132/11', rating: '50 MVA' },
};

SLD_COMP.transformer3w = {
  type: 'transformer3w',
  label: 'Xfmr 3W',
  category: 'Transformers',
  w: 60, h: 60,
  ports: [
    { id: 'hv',  x: 30, y: 0,  dir: 'in',  label: 'HV Side' },
    { id: 'mv',  x: 60, y: 45, dir: 'out', label: 'MV Side' },
    { id: 'lv',  x: 30, y: 60, dir: 'out', label: 'LV Side' },
  ],
  svg() {
    return `<svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="16" r="14" class="stroke-magenta" stroke-width="2" fill="none"/>
      <circle cx="20" cy="38" r="14" class="stroke-magenta" stroke-width="2" fill="none"/>
      <circle cx="40" cy="38" r="14" class="stroke-magenta" stroke-width="2" fill="none"/>
    </svg>`;
  },
  defaults: { voltage: '132/33/11', rating: '100 MVA' },
};

/* ═══════════════════════════════════════════════════════
   SWITCHING DEVICES
   ═══════════════════════════════════════════════════════ */

SLD_COMP.cb = {
  type: 'cb',
  label: 'CB',
  category: 'Switching',
  w: 30, h: 30,
  ports: [
    { id: 'in',  x: 15, y: 0,  dir: 'in',  label: 'Line Side' },
    { id: 'out', x: 15, y: 30, dir: 'out', label: 'Load Side' },
  ],
  svg() {
    return `<svg width="30" height="30" viewBox="0 0 30 30">
      <rect x="3" y="3" width="24" height="24" rx="2" class="stroke-green" stroke-width="2" fill="rgba(0,0,0,0.3)"/>
      <line x1="7" y1="7" x2="23" y2="23" class="stroke-green" stroke-width="2"/>
      <line x1="23" y1="7" x2="7" y2="23" class="stroke-green" stroke-width="2"/>
    </svg>`;
  },
  defaults: { rating: '630A', state: 'closed' },
};

SLD_COMP.disconnector = {
  type: 'disconnector',
  label: 'DS',
  category: 'Switching',
  w: 24, h: 30,
  ports: [
    { id: 'in',  x: 12, y: 0,  dir: 'in',  label: 'Top' },
    { id: 'out', x: 12, y: 30, dir: 'out', label: 'Bottom' },
  ],
  svg() {
    return `<svg width="24" height="30" viewBox="0 0 24 30">
      <line x1="12" y1="0" x2="12" y2="10" class="stroke-main" stroke-width="2"/>
      <line x1="12" y1="10" x2="12" y2="20" class="stroke-green" stroke-width="2"/>
      <line x1="12" y1="20" x2="12" y2="30" class="stroke-main" stroke-width="2"/>
      <circle cx="12" cy="10" r="3" fill="none" class="stroke-green" stroke-width="1.5"/>
      <circle cx="12" cy="20" r="3" fill="none" class="stroke-green" stroke-width="1.5"/>
    </svg>`;
  },
  defaults: { rating: '630A', state: 'closed' },
};

SLD_COMP.fuse = {
  type: 'fuse',
  label: 'Fuse',
  category: 'Switching',
  w: 20, h: 36,
  ports: [
    { id: 'in',  x: 10, y: 0,  dir: 'in',  label: 'Top' },
    { id: 'out', x: 10, y: 36, dir: 'out', label: 'Bottom' },
  ],
  svg() {
    return `<svg width="20" height="36" viewBox="0 0 20 36">
      <line x1="10" y1="0" x2="10" y2="8" class="stroke-main" stroke-width="2"/>
      <rect x="4" y="8" width="12" height="20" rx="2" class="stroke-red" stroke-width="2" fill="none"/>
      <line x1="10" y1="14" x2="10" y2="22" class="stroke-red" stroke-width="1.5"/>
      <line x1="10" y1="28" x2="10" y2="36" class="stroke-main" stroke-width="2"/>
    </svg>`;
  },
  defaults: { rating: '200A' },
};

/* ═══════════════════════════════════════════════════════
   LOADS & MOTORS
   ═══════════════════════════════════════════════════════ */

SLD_COMP.load = {
  type: 'load',
  label: 'Load',
  category: 'Loads',
  w: 36, h: 32,
  ports: [
    { id: 'in', x: 18, y: 0, dir: 'in', label: 'Supply' },
  ],
  svg() {
    return `<svg width="36" height="32" viewBox="0 0 36 32">
      <polygon points="18,0 36,32 0,32" class="stroke-accent" stroke-width="2" fill="none"/>
    </svg>`;
  },
  defaults: { rating: '5 MW', voltage: '0.4' },
};

SLD_COMP.motor = {
  type: 'motor',
  label: 'Motor',
  category: 'Loads',
  w: 44, h: 44,
  ports: [
    { id: 'in', x: 22, y: 0, dir: 'in', label: 'Supply' },
  ],
  svg() {
    return `<svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" stroke="#4f8cff" stroke-width="2" fill="rgba(0,0,0,0.3)"/>
      <text x="22" y="27" text-anchor="middle" fill="#4f8cff" font-size="16" font-weight="700">M</text>
    </svg>`;
  },
  defaults: { rating: '500 kW', voltage: '0.4' },
};

/* ═══════════════════════════════════════════════════════
   INSTRUMENT TRANSFORMERS
   ═══════════════════════════════════════════════════════ */

SLD_COMP.ct = {
  type: 'ct',
  label: 'CT',
  category: 'Instruments',
  w: 30, h: 30,
  ports: [
    { id: 'in',      x: 15, y: 0,  dir: 'in',  label: 'Primary In' },
    { id: 'out',     x: 15, y: 30, dir: 'out', label: 'Primary Out' },
    { id: 'sec',     x: 30, y: 15, dir: 'out', label: 'Secondary (to Relay)' },
  ],
  svg() {
    return `<svg width="30" height="30" viewBox="0 0 30 30">
      <line x1="15" y1="0" x2="15" y2="8" class="stroke-main" stroke-width="2"/>
      <circle cx="15" cy="15" r="7" class="stroke-magenta" stroke-width="2" fill="none"/>
      <circle cx="15" cy="15" r="3" fill="#e040fb" opacity="0.3"/>
      <line x1="15" y1="22" x2="15" y2="30" class="stroke-main" stroke-width="2"/>
    </svg>`;
  },
  defaults: { ratio: '200/5 A' },
};

SLD_COMP.vt = {
  type: 'vt',
  label: 'VT',
  category: 'Instruments',
  w: 30, h: 30,
  ports: [
    { id: 'in',  x: 15, y: 0,  dir: 'in',  label: 'Primary' },
    { id: 'out', x: 15, y: 30, dir: 'out', label: 'Primary Out' },
    { id: 'sec', x: 30, y: 15, dir: 'out', label: 'Secondary (to Relay)' },
  ],
  svg() {
    return `<svg width="30" height="30" viewBox="0 0 30 30">
      <line x1="15" y1="0" x2="15" y2="8" class="stroke-main" stroke-width="2"/>
      <rect x="5" y="8" width="20" height="14" rx="2" class="stroke-orange" stroke-width="2" fill="none"/>
      <text x="15" y="19" text-anchor="middle" fill="#ff9100" font-size="9" font-weight="600">VT</text>
      <line x1="15" y1="22" x2="15" y2="30" class="stroke-main" stroke-width="2"/>
    </svg>`;
  },
  defaults: { ratio: '11000/110 V' },
};

/* ═══════════════════════════════════════════════════════
   PROTECTION RELAYS
   Realistic modelling: each relay type defines required
   input ports for its sensing elements.
   ═══════════════════════════════════════════════════════ */

SLD_COMP.relay_oc = {
  type: 'relay_oc',
  label: 'OC Relay',
  category: 'Protection',
  w: 52, h: 36,
  // Overcurrent: 1 CT input, 1 trip output
  ports: [
    { id: 'ct_in', x: 0,  y: 18, dir: 'in',  label: 'CT Input' },
    { id: 'trip',  x: 52, y: 18, dir: 'out', label: 'Trip (to CB)' },
  ],
  requiredCT: 1,
  svg() {
    return `<svg width="52" height="36" viewBox="0 0 52 36">
      ${relayBox(52, 36, '50/51', '#00e5ff')}
    </svg>`;
  },
  defaults: { pickup: '100A', tms: '0.1', curve: 'SI' },
};

SLD_COMP.relay_diff = {
  type: 'relay_diff',
  label: 'Diff Relay',
  category: 'Protection',
  w: 60, h: 52,
  // Differential: 2+ CT inputs (one per protected zone side), 1 trip output
  ports: [
    { id: 'ct_in1', x: 0,  y: 14, dir: 'in',  label: 'CT Input 1 (Side A)' },
    { id: 'ct_in2', x: 0,  y: 38, dir: 'in',  label: 'CT Input 2 (Side B)' },
    { id: 'ct_in3', x: 30, y: 52, dir: 'in',  label: 'CT Input 3 (optional)' },
    { id: 'trip',   x: 60, y: 26, dir: 'out', label: 'Trip (to CB)' },
  ],
  requiredCT: 2,
  svg() {
    return `<svg width="60" height="52" viewBox="0 0 60 52">
      ${relayBox(60, 52, '87', '#ffd700')}
      <line x1="4" y1="14" x2="14" y2="14" stroke="#00e5ff" stroke-width="1.5"/>
      <text x="16" y="17" fill="#5a6a7e" font-size="7">CT₁</text>
      <line x1="4" y1="38" x2="14" y2="38" stroke="#00e5ff" stroke-width="1.5"/>
      <text x="16" y="41" fill="#5a6a7e" font-size="7">CT₂</text>
    </svg>`;
  },
  defaults: { pickup: '0.2 pu', slope: '25%' },
};

SLD_COMP.relay_dist = {
  type: 'relay_dist',
  label: 'Dist Relay',
  category: 'Protection',
  w: 56, h: 44,
  // Distance: 1 CT + 1 VT input, 1 trip output
  ports: [
    { id: 'ct_in', x: 0,  y: 14, dir: 'in',  label: 'CT Input' },
    { id: 'vt_in', x: 0,  y: 30, dir: 'in',  label: 'VT Input' },
    { id: 'trip',  x: 56, y: 22, dir: 'out', label: 'Trip (to CB)' },
  ],
  requiredCT: 1,
  requiredVT: 1,
  svg() {
    return `<svg width="56" height="44" viewBox="0 0 56 44">
      ${relayBox(56, 44, '21', '#4f8cff')}
      <line x1="4" y1="14" x2="12" y2="14" stroke="#00e5ff" stroke-width="1.5"/>
      <text x="14" y="17" fill="#5a6a7e" font-size="7">CT</text>
      <line x1="4" y1="30" x2="12" y2="30" stroke="#ff9100" stroke-width="1.5"/>
      <text x="14" y="33" fill="#5a6a7e" font-size="7">VT</text>
    </svg>`;
  },
  defaults: { zone1: '80%', zone2: '120%', zone3: '200%' },
};

SLD_COMP.relay_ef = {
  type: 'relay_ef',
  label: 'EF Relay',
  category: 'Protection',
  w: 52, h: 36,
  // Earth Fault: 1 CT input (residual), 1 trip output
  ports: [
    { id: 'ct_in', x: 0,  y: 18, dir: 'in',  label: 'CT Input (Residual)' },
    { id: 'trip',  x: 52, y: 18, dir: 'out', label: 'Trip (to CB)' },
  ],
  requiredCT: 1,
  svg() {
    return `<svg width="52" height="36" viewBox="0 0 52 36">
      ${relayBox(52, 36, '51N', '#ff5252')}
    </svg>`;
  },
  defaults: { pickup: '20A', tms: '0.1', curve: 'SI' },
};

/* ═══════════════════════════════════════════════════════
   PALETTE ICON RENDERER — draws small icons in the palette
   ═══════════════════════════════════════════════════════ */

function renderPaletteIcons() {
  const iconMap = {
    'pi-utility':       () => `<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="5,2 19,2 23,12 19,22 5,22 1,12" stroke="#00e676" fill="none" stroke-width="1.5"/><text x="12" y="15" text-anchor="middle" fill="#00e676" font-size="10">~</text></svg>`,
    'pi-generator':     () => `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#00e676" fill="none" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" fill="#00e676" font-size="11" font-weight="700">G</text></svg>`,
    'pi-bus':           () => `<svg width="28" height="8" viewBox="0 0 28 8"><rect x="0" y="2" width="28" height="4" rx="1" fill="#c8d6e5"/></svg>`,
    'pi-line':          () => `<svg width="10" height="24" viewBox="0 0 10 24"><line x1="5" y1="0" x2="5" y2="24" stroke="#c8d6e5" stroke-width="1.5"/></svg>`,
    'pi-cable':         () => `<svg width="10" height="24" viewBox="0 0 10 24"><line x1="5" y1="0" x2="5" y2="24" stroke="#c8d6e5" stroke-width="1.5" stroke-dasharray="4 2"/></svg>`,
    'pi-transformer2w': () => `<svg width="24" height="28" viewBox="0 0 24 28"><circle cx="12" cy="10" r="8" stroke="#e040fb" fill="none" stroke-width="1.5"/><circle cx="12" cy="18" r="8" stroke="#e040fb" fill="none" stroke-width="1.5"/></svg>`,
    'pi-transformer3w': () => `<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="8" r="7" stroke="#e040fb" fill="none" stroke-width="1.2"/><circle cx="8" cy="20" r="7" stroke="#e040fb" fill="none" stroke-width="1.2"/><circle cx="20" cy="20" r="7" stroke="#e040fb" fill="none" stroke-width="1.2"/></svg>`,
    'pi-cb':            () => `<svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2" stroke="#00e676" fill="none" stroke-width="1.5"/><line x1="5" y1="5" x2="15" y2="15" stroke="#00e676" stroke-width="1.5"/><line x1="15" y1="5" x2="5" y2="15" stroke="#00e676" stroke-width="1.5"/></svg>`,
    'pi-disconnector':  () => `<svg width="16" height="24" viewBox="0 0 16 24"><line x1="8" y1="0" x2="8" y2="8" stroke="#c8d6e5" stroke-width="1.5"/><circle cx="8" cy="8" r="2" stroke="#00e676" fill="none" stroke-width="1"/><line x1="8" y1="10" x2="8" y2="14" stroke="#00e676" stroke-width="1.5"/><circle cx="8" cy="16" r="2" stroke="#00e676" fill="none" stroke-width="1"/><line x1="8" y1="18" x2="8" y2="24" stroke="#c8d6e5" stroke-width="1.5"/></svg>`,
    'pi-fuse':          () => `<svg width="12" height="24" viewBox="0 0 12 24"><rect x="2" y="4" width="8" height="16" rx="1" stroke="#ff5252" fill="none" stroke-width="1.2"/><line x1="6" y1="0" x2="6" y2="4" stroke="#c8d6e5" stroke-width="1.2"/><line x1="6" y1="20" x2="6" y2="24" stroke="#c8d6e5" stroke-width="1.2"/></svg>`,
    'pi-load':          () => `<svg width="24" height="20" viewBox="0 0 24 20"><polygon points="12,0 24,20 0,20" stroke="#ffd700" fill="none" stroke-width="1.5"/></svg>`,
    'pi-motor':         () => `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#4f8cff" fill="none" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" fill="#4f8cff" font-size="11" font-weight="700">M</text></svg>`,
    'pi-ct':            () => `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" stroke="#e040fb" fill="none" stroke-width="1.5"/></svg>`,
    'pi-vt':            () => `<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1" stroke="#ff9100" fill="none" stroke-width="1.2"/><text x="10" y="13" text-anchor="middle" fill="#ff9100" font-size="7">VT</text></svg>`,
    'pi-relay-oc':      () => `<svg width="28" height="20" viewBox="0 0 28 20"><rect x="1" y="1" width="26" height="18" rx="3" stroke="#00e5ff" fill="none" stroke-width="1.2" stroke-dasharray="4 2"/><text x="14" y="13" text-anchor="middle" fill="#00e5ff" font-size="8" font-weight="700">OC</text></svg>`,
    'pi-relay-diff':    () => `<svg width="28" height="20" viewBox="0 0 28 20"><rect x="1" y="1" width="26" height="18" rx="3" stroke="#ffd700" fill="none" stroke-width="1.2" stroke-dasharray="4 2"/><text x="14" y="13" text-anchor="middle" fill="#ffd700" font-size="8" font-weight="700">87</text></svg>`,
    'pi-relay-dist':    () => `<svg width="28" height="20" viewBox="0 0 28 20"><rect x="1" y="1" width="26" height="18" rx="3" stroke="#4f8cff" fill="none" stroke-width="1.2" stroke-dasharray="4 2"/><text x="14" y="13" text-anchor="middle" fill="#4f8cff" font-size="8" font-weight="700">21</text></svg>`,
    'pi-relay-ef':      () => `<svg width="28" height="20" viewBox="0 0 28 20"><rect x="1" y="1" width="26" height="18" rx="3" stroke="#ff5252" fill="none" stroke-width="1.2" stroke-dasharray="4 2"/><text x="14" y="13" text-anchor="middle" fill="#ff5252" font-size="8" font-weight="700">51N</text></svg>`,
  };

  for (const [id, fn] of Object.entries(iconMap)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = fn();
  }
}
