'use strict';

/**
 * sld-params.js — Electrical analysis parameter schemas for each SLD component type.
 *
 * Each entry in COMP_PARAMS[type] defines the parameters required for that
 * component to participate in power system steady-state analysis (load flow,
 * fault analysis, protection coordination).
 *
 * Field types:
 *   'number'  – numeric input (step, min, max optional)
 *   'select'  – dropdown from options[]
 *   'text'    – free text
 */

const COMP_PARAMS = {

  /* ═════════════════════════════════════════════════════
     UTILITY / GRID (Slack Bus)
     ═════════════════════════════════════════════════════ */
  utility: [
    { id: 'kv',      label: 'System Voltage',         unit: 'kV',  type: 'number', default: 132,  step: 1,    min: 0.1 },
    { id: 'mva_sc',  label: 'Fault Level (MVA s/c)',  unit: 'MVA', type: 'number', default: 1000, step: 10,   min: 1 },
    { id: 'xr',      label: 'X/R Ratio',              unit: '-',   type: 'number', default: 10,   step: 0.5,  min: 0.1 },
    { id: 'v_pu',    label: 'Reference Voltage',       unit: 'pu',  type: 'number', default: 1.0,  step: 0.01, min: 0.8, max: 1.2 },
    { id: 'angle',   label: 'Reference Angle',         unit: '°',   type: 'number', default: 0,    step: 1 },
  ],

  /* ═════════════════════════════════════════════════════
     GENERATOR (PV Bus)
     ═════════════════════════════════════════════════════ */
  generator: [
    { id: 'mva',     label: 'Rated MVA',              unit: 'MVA', type: 'number', default: 100,  step: 1,    min: 0.001 },
    { id: 'kv',      label: 'Rated Voltage',           unit: 'kV',  type: 'number', default: 11,   step: 0.1,  min: 0.1 },
    { id: 'pf',      label: 'Rated Power Factor',      unit: 'pu',  type: 'number', default: 0.85, step: 0.01, min: 0.1, max: 1 },
    { id: 'pg',      label: 'Active Power (Pg)',        unit: 'MW',  type: 'number', default: 80,   step: 1 },
    { id: 'vg',      label: 'Terminal Voltage (Vg)',    unit: 'pu',  type: 'number', default: 1.0,  step: 0.01, min: 0.8, max: 1.2 },
    { id: 'qmax',    label: 'Q max',                   unit: 'MVAR',type: 'number', default: 60,   step: 1 },
    { id: 'qmin',    label: 'Q min',                   unit: 'MVAR',type: 'number', default: -30,  step: 1 },
    { id: 'xd',      label: 'Xd (synchronous)',        unit: 'pu',  type: 'number', default: 1.95, step: 0.01, min: 0 },
    { id: 'xd_t',    label: "Xd' (transient)",         unit: 'pu',  type: 'number', default: 0.32, step: 0.01, min: 0 },
    { id: 'xd_st',   label: "Xd'' (subtransient)",     unit: 'pu',  type: 'number', default: 0.22, step: 0.01, min: 0 },
    { id: 'x0',      label: 'X0 (zero-sequence)',       unit: 'pu',  type: 'number', default: 0.06, step: 0.01, min: 0 },
    { id: 'x2',      label: 'X2 (negative-seq)',        unit: 'pu',  type: 'number', default: 0.21, step: 0.01, min: 0 },
    { id: 'h',       label: 'Inertia Constant H',      unit: 's',   type: 'number', default: 3.0,  step: 0.1,  min: 0 },
    { id: 'ra',      label: 'Armature Resistance (Ra)',unit: 'pu',  type: 'number', default: 0.003,step: 0.001,min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     BUS (Node)
     ═════════════════════════════════════════════════════ */
  bus: [
    { id: 'kv',       label: 'Nominal Voltage',         unit: 'kV',  type: 'number', default: 11,   step: 0.1,  min: 0.1 },
    { id: 'bus_type', label: 'Bus Type (for PF)',       unit: '',    type: 'select', default: 'PQ',
      options: ['PQ', 'PV', 'Slack'] },
    { id: 'v_init',   label: 'Initial Voltage Guess',   unit: 'pu',  type: 'number', default: 1.0,  step: 0.01, min: 0.5, max: 1.5 },
    { id: 'angle_init',label: 'Initial Angle Guess',   unit: '°',   type: 'number', default: 0,    step: 1 },
  ],

  /* ═════════════════════════════════════════════════════
     TRANSMISSION LINE
     ═════════════════════════════════════════════════════ */
  line: [
    { id: 'kv',       label: 'Voltage Rating',           unit: 'kV',    type: 'number', default: 132,  step: 1,    min: 0.1 },
    { id: 'len',      label: 'Length',                   unit: 'km',    type: 'number', default: 50,   step: 0.1,  min: 0 },
    { id: 'r1',       label: 'R (pos-seq)',               unit: 'Ω/km', type: 'number', default: 0.07, step: 0.001,min: 0 },
    { id: 'x1',       label: 'X (pos-seq)',               unit: 'Ω/km', type: 'number', default: 0.37, step: 0.001,min: 0 },
    { id: 'b1',       label: 'B (susceptance)',           unit: 'μS/km',type: 'number', default: 3.0,  step: 0.01, min: 0 },
    { id: 'r0',       label: 'R0 (zero-seq)',             unit: 'Ω/km', type: 'number', default: 0.35, step: 0.001,min: 0 },
    { id: 'x0',       label: 'X0 (zero-seq)',             unit: 'Ω/km', type: 'number', default: 1.10, step: 0.001,min: 0 },
    { id: 'ampacity', label: 'Thermal Rating',            unit: 'A',     type: 'number', default: 900,  step: 1,    min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     CABLE
     ═════════════════════════════════════════════════════ */
  cable: [
    { id: 'kv',       label: 'Voltage Rating',           unit: 'kV',    type: 'number', default: 11,   step: 0.1,  min: 0.1 },
    { id: 'len',      label: 'Length',                   unit: 'km',    type: 'number', default: 1.0,  step: 0.01, min: 0 },
    { id: 'r1',       label: 'R (pos-seq)',               unit: 'Ω/km', type: 'number', default: 0.060,step: 0.001,min: 0 },
    { id: 'x1',       label: 'X (pos-seq)',               unit: 'Ω/km', type: 'number', default: 0.097,step: 0.001,min: 0 },
    { id: 'c1',       label: 'Capacitance',               unit: 'μF/km',type: 'number', default: 0.33, step: 0.01, min: 0 },
    { id: 'r0',       label: 'R0 (zero-seq)',             unit: 'Ω/km', type: 'number', default: 0.3,  step: 0.001,min: 0 },
    { id: 'x0',       label: 'X0 (zero-seq)',             unit: 'Ω/km', type: 'number', default: 0.4,  step: 0.001,min: 0 },
    { id: 'ampacity', label: 'Thermal Rating',            unit: 'A',     type: 'number', default: 545,  step: 1,    min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     2-WINDING TRANSFORMER
     ═════════════════════════════════════════════════════ */
  transformer2w: [
    { id: 'mva',      label: 'Rated MVA',               unit: 'MVA', type: 'number', default: 50,    step: 0.1,  min: 0.001 },
    { id: 'hv_kv',   label: 'HV Voltage',               unit: 'kV',  type: 'number', default: 132,   step: 0.1,  min: 0.1 },
    { id: 'lv_kv',   label: 'LV Voltage',               unit: 'kV',  type: 'number', default: 11,    step: 0.1,  min: 0.1 },
    { id: 'z_pct',   label: 'Impedance Z%',              unit: '%',   type: 'number', default: 12.5,  step: 0.1,  min: 0 },
    { id: 'r_pct',   label: 'Resistance R% (load loss)', unit: '%',   type: 'number', default: 0.5,   step: 0.01, min: 0 },
    { id: 'tap',     label: 'Tap Ratio',                 unit: 'pu',  type: 'number', default: 1.0,   step: 0.01, min: 0.5, max: 1.5 },
    { id: 'vg',      label: 'Vector Group',              unit: '',    type: 'text',   default: 'YNd11' },
    { id: 'no_load_loss', label: 'No-load Loss',         unit: 'kW',  type: 'number', default: 22,    step: 0.1,  min: 0 },
    { id: 'load_loss',label: 'Load Loss (at rated)',      unit: 'kW',  type: 'number', default: 175,   step: 0.1,  min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     3-WINDING TRANSFORMER
     ═════════════════════════════════════════════════════ */
  transformer3w: [
    { id: 'mva',      label: 'Rated MVA',               unit: 'MVA', type: 'number', default: 100,   step: 1,    min: 0.001 },
    { id: 'hv_kv',   label: 'HV Voltage',               unit: 'kV',  type: 'number', default: 132,   step: 0.1,  min: 0.1 },
    { id: 'mv_kv',   label: 'MV Voltage',               unit: 'kV',  type: 'number', default: 33,    step: 0.1,  min: 0.1 },
    { id: 'lv_kv',   label: 'LV Voltage',               unit: 'kV',  type: 'number', default: 11,    step: 0.1,  min: 0.1 },
    { id: 'z_hm',    label: 'ZHM (HV-MV)',              unit: '%',   type: 'number', default: 12.0,  step: 0.1,  min: 0 },
    { id: 'z_hl',    label: 'ZHL (HV-LV)',              unit: '%',   type: 'number', default: 14.0,  step: 0.1,  min: 0 },
    { id: 'z_ml',    label: 'ZML (MV-LV)',              unit: '%',   type: 'number', default: 8.0,   step: 0.1,  min: 0 },
    { id: 'tap_hv',  label: 'HV Tap Ratio',             unit: 'pu',  type: 'number', default: 1.0,   step: 0.01, min: 0.8, max: 1.2 },
    { id: 'vg',      label: 'Vector Group',              unit: '',    type: 'text',   default: 'YNyn0d11' },
  ],

  /* ═════════════════════════════════════════════════════
     LOAD (PQ Bus)
     ═════════════════════════════════════════════════════ */
  load: [
    { id: 'kv',      label: 'Bus Voltage',              unit: 'kV',  type: 'number', default: 0.4,  step: 0.1,  min: 0.1 },
    { id: 'mw',      label: 'Active Power P',           unit: 'MW',  type: 'number', default: 5,    step: 0.1,  min: 0 },
    { id: 'mvar',    label: 'Reactive Power Q',         unit: 'MVAR',type: 'number', default: 2,    step: 0.1 },
    { id: 'pf',      label: 'Power Factor',             unit: 'lag', type: 'number', default: 0.93, step: 0.01, min: 0.1, max: 1 },
    { id: 'load_type',label: 'Load Model',              unit: '',    type: 'select', default: 'Constant Power',
      options: ['Constant Power', 'Constant Current', 'Constant Impedance', 'Motor'] },
  ],

  /* ═════════════════════════════════════════════════════
     MOTOR
     ═════════════════════════════════════════════════════ */
  motor: [
    { id: 'kv',      label: 'Rated Voltage',            unit: 'kV',  type: 'number', default: 0.4,  step: 0.1,  min: 0.1 },
    { id: 'kw',      label: 'Rated Output Power',       unit: 'kW',  type: 'number', default: 500,  step: 1,    min: 0 },
    { id: 'eff',     label: 'Efficiency at Full Load',  unit: '%',   type: 'number', default: 96,   step: 0.1,  min: 0, max: 100 },
    { id: 'pf',      label: 'Power Factor (full load)', unit: 'pu',  type: 'number', default: 0.87, step: 0.01, min: 0.1, max: 1 },
    { id: 'lrc',     label: 'Locked Rotor Current Ist/In', unit: 'pu', type: 'number', default: 7.0,step: 0.1, min: 0 },
    { id: 'start_pf',label: 'Starting Power Factor',    unit: 'pu',  type: 'number', default: 0.25, step: 0.01, min: 0, max: 1 },
    { id: 'xd',      label: 'Subtransient Reactance X"',unit: 'pu',  type: 'number', default: 0.17, step: 0.01, min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     CIRCUIT BREAKER
     ═════════════════════════════════════════════════════ */
  cb: [
    { id: 'cb_type', label: 'CB Technology',            unit: '',    type: 'select', default: 'VCB',
      options: ['ACB', 'MCCB', 'VCB', 'SF6', 'Air Blast', 'Oil CB'] },
    { id: 'kv',      label: 'Rated Voltage',            unit: 'kV',  type: 'number', default: 12,   step: 0.01, min: 0.1 },
    { id: 'rating_a',label: 'Rated Continuous Current', unit: 'A',   type: 'number', default: 2500, step: 50,   min: 1 },
    { id: 'icu',     label: 'Ultimate Breaking Cap Icu',unit: 'kA',  type: 'number', default: 40,   step: 1,    min: 0 },
    { id: 'ics',     label: 'Service Breaking Cap Ics', unit: 'kA',  type: 'number', default: 40,   step: 1,    min: 0 },
    { id: 'icm',     label: 'Making Capacity Icm',      unit: 'kA',  type: 'number', default: 100,  step: 1,    min: 0 },
    { id: 'stkw',    label: 'Short-time Withstand STW', unit: 'kA',  type: 'number', default: 40,   step: 1,    min: 0 },
    { id: 't_open',  label: 'Opening Time',             unit: 'ms',  type: 'number', default: 55,   step: 1,    min: 0 },
    { id: 't_close', label: 'Closing Time',             unit: 'ms',  type: 'number', default: 65,   step: 1,    min: 0 },
    { id: 'state',   label: 'State',                    unit: '',    type: 'select', default: 'Closed',
      options: ['Closed', 'Open'] },
  ],

  /* ═════════════════════════════════════════════════════
     DISCONNECTOR / ISOLATOR
     ═════════════════════════════════════════════════════ */
  disconnector: [
    { id: 'ds_type', label: 'Disconnector Type',        unit: '',    type: 'select', default: 'Indoor',
      options: ['Indoor', 'Outdoor', 'GIS', 'Ring Main'] },
    { id: 'kv',      label: 'Rated Voltage',            unit: 'kV',  type: 'number', default: 12,   step: 0.01, min: 0.1 },
    { id: 'rating_a',label: 'Rated Continuous Current', unit: 'A',   type: 'number', default: 1250, step: 50,   min: 1 },
    { id: 'stkw',    label: 'Short-time Withstand STW', unit: 'kA',  type: 'number', default: 25,   step: 1,    min: 0 },
    { id: 'peak',    label: 'Peak Withstand',           unit: 'kA',  type: 'number', default: 63,   step: 1,    min: 0 },
    { id: 'ins_kv',  label: 'Insulation Level (BIL)',   unit: 'kV',  type: 'number', default: 28,   step: 1,    min: 0 },
    { id: 'state',   label: 'State',                    unit: '',    type: 'select', default: 'Closed',
      options: ['Closed', 'Open'] },
  ],

  /* ═════════════════════════════════════════════════════
     FUSE
     ═════════════════════════════════════════════════════ */
  fuse: [
    { id: 'fuse_type',label: 'Fuse Class',              unit: '',    type: 'select', default: 'HRC Back-up',
      options: ['HRC Back-up', 'HRC Full-range', 'Drop-out', 'Expulsion'] },
    { id: 'kv',      label: 'Rated Voltage',            unit: 'kV',  type: 'number', default: 12,   step: 0.1,  min: 0.1 },
    { id: 'rating_a',label: 'Rated Current',            unit: 'A',   type: 'number', default: 63,   step: 1,    min: 1 },
    { id: 'icu',     label: 'Breaking Capacity',        unit: 'kA',  type: 'number', default: 50,   step: 1,    min: 0 },
    { id: 'i2t_min', label: 'Let-through I²t (min)',    unit: 'A²s', type: 'number', default: 280,  step: 1,    min: 0 },
    { id: 'i2t_max', label: 'Let-through I²t (max)',    unit: 'A²s', type: 'number', default: 3200, step: 10,   min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     CURRENT TRANSFORMER (CT)
     ═════════════════════════════════════════════════════ */
  ct: [
    { id: 'kv',      label: 'System Voltage',           unit: 'kV',  type: 'number', default: 11,   step: 0.1,  min: 0.1 },
    { id: 'ratio',   label: 'CT Ratio (Ip/Is)',         unit: 'A/A', type: 'text',   default: '200/5' },
    { id: 'class',   label: 'Accuracy Class',           unit: '',    type: 'select', default: '5P20',
      options: ['0.1', '0.2', '0.2S', '0.5', '0.5S', '1', '3', '5P10', '5P20', '10P10', '10P20', 'PX', 'TPS'] },
    { id: 'burden',  label: 'Rated Burden',             unit: 'VA',  type: 'number', default: 15,   step: 1,    min: 0 },
    { id: 'alf',     label: 'Accuracy Limit Factor',    unit: '-',   type: 'number', default: 20,   step: 1,    min: 1 },
    { id: 'thermal', label: 'Thermal Rating (1s)',       unit: 'kA',  type: 'number', default: 25,   step: 0.5,  min: 0 },
    { id: 'dynamic', label: 'Dynamic Rating',           unit: 'kA',  type: 'number', default: 63,   step: 0.5,  min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     VOLTAGE TRANSFORMER (VT/PT)
     ═════════════════════════════════════════════════════ */
  vt: [
    { id: 'vt_type', label: 'VT Type',                 unit: '',    type: 'select', default: 'Wound',
      options: ['Wound', 'Inductive', 'Capacitive (CVT)'] },
    { id: 'ratio',   label: 'VT Ratio (Vp/Vs)',        unit: 'V/V', type: 'text',   default: '11000/110' },
    { id: 'class',   label: 'Accuracy Class',           unit: '',    type: 'select', default: '0.5',
      options: ['0.1', '0.2', '0.2S', '0.5', '1', '3', '3P', '6P'] },
    { id: 'burden',  label: 'Rated Burden',             unit: 'VA',  type: 'number', default: 50,   step: 1,    min: 0 },
    { id: 'vf',      label: 'Voltage Factor',           unit: '',    type: 'text',   default: '1.2/30s' },
    { id: 'kv',      label: 'Primary Rated Voltage',    unit: 'kV',  type: 'number', default: 11,   step: 0.1,  min: 0.1 },
    { id: 'sec_v',   label: 'Secondary Voltage',        unit: 'V',   type: 'number', default: 110,  step: 1,    min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     RELAY: Overcurrent (50/51)
     ═════════════════════════════════════════════════════ */
  relay_oc: [
    { id: 'pickup',  label: 'Pickup Current (Is)',      unit: 'xIn', type: 'number', default: 1.2,  step: 0.01, min: 0.05 },
    { id: 'tms',     label: 'Time Multiplier (TMS)',    unit: '-',   type: 'number', default: 0.3,  step: 0.05, min: 0.01 },
    { id: 'curve',   label: 'Characteristic Curve',    unit: '',    type: 'select', default: 'IEC Standard Inverse',
      options: ['IEC Standard Inverse (SI)', 'IEC Very Inverse (VI)', 'IEC Extremely Inverse (EI)',
                'IEC Long Time Inverse (LTI)', 'IEEE Moderately Inverse (MI)', 'IEEE Very Inverse (VI)',
                'IEEE Extremely Inverse (EI)', 'Definite Time'] },
    { id: 'inst_pickup', label: 'Instantaneous (50) Pickup', unit: 'xIn', type: 'number', default: 10, step: 0.5, min: 0 },
    { id: 'inst_enable', label: 'Instantaneous Enabled', unit: '', type: 'select', default: 'Yes',
      options: ['Yes', 'No'] },
  ],

  /* ═════════════════════════════════════════════════════
     RELAY: Differential (87)
     ═════════════════════════════════════════════════════ */
  relay_diff: [
    { id: 'slope1',  label: 'Differential Slope 1',    unit: '%',   type: 'number', default: 25,   step: 1,    min: 0 },
    { id: 'slope2',  label: 'Differential Slope 2',    unit: '%',   type: 'number', default: 50,   step: 1,    min: 0 },
    { id: 'idiff',   label: 'Min Diff Pickup',          unit: 'pu',  type: 'number', default: 0.2,  step: 0.05, min: 0 },
    { id: 'irest',   label: 'Bias (Restraint) Start',  unit: 'pu',  type: 'number', default: 0.5,  step: 0.05, min: 0 },
    { id: 'inrush_block', label: 'Inrush Block (2nd harmonic)', unit: '%', type: 'number', default: 15, step: 1, min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     RELAY: Distance (21)
     ═════════════════════════════════════════════════════ */
  relay_dist: [
    { id: 'z1_pct', label: 'Zone 1 Reach',             unit: '%',   type: 'number', default: 80,   step: 1,    min: 0 },
    { id: 'z2_pct', label: 'Zone 2 Reach',             unit: '%',   type: 'number', default: 120,  step: 1,    min: 0 },
    { id: 'z3_pct', label: 'Zone 3 Reach',             unit: '%',   type: 'number', default: 200,  step: 1,    min: 0 },
    { id: 't1',     label: 'Zone 1 Time Delay',         unit: 'ms',  type: 'number', default: 0,    step: 10,   min: 0 },
    { id: 't2',     label: 'Zone 2 Time Delay',         unit: 'ms',  type: 'number', default: 350,  step: 10,   min: 0 },
    { id: 't3',     label: 'Zone 3 Time Delay',         unit: 'ms',  type: 'number', default: 800,  step: 10,   min: 0 },
    { id: 'char',   label: 'Characteristic',            unit: '',    type: 'select', default: 'Quadrilateral',
      options: ['Mho', 'Quadrilateral', 'Offset Mho', 'Reactance', 'Lens'] },
    { id: 'zline',  label: 'Line Impedance Z1',         unit: 'Ω',  type: 'number', default: 10,   step: 0.1,  min: 0 },
    { id: 'zang',   label: 'Line Angle',                unit: '°',   type: 'number', default: 75,   step: 1,    min: 0 },
  ],

  /* ═════════════════════════════════════════════════════
     RELAY: Earth Fault (51N)
     ═════════════════════════════════════════════════════ */
  relay_ef: [
    { id: 'pickup',  label: 'Earth Fault Pickup (Io)',  unit: 'xIn', type: 'number', default: 0.2,  step: 0.01, min: 0.01 },
    { id: 'tms',     label: 'Time Multiplier (TMS)',    unit: '-',   type: 'number', default: 0.1,  step: 0.01, min: 0.01 },
    { id: 'curve',   label: 'Characteristic Curve',    unit: '',    type: 'select', default: 'IEC Standard Inverse',
      options: ['IEC Standard Inverse (SI)', 'IEC Very Inverse (VI)', 'IEC Extremely Inverse (EI)',
                'IEC Long Time Inverse (LTI)', 'Definite Time'] },
    { id: 'inst_pickup', label: 'Instantaneous (50N)',  unit: 'xIn', type: 'number', default: 5,    step: 0.5,  min: 0 },
  ],
};
