const { pool } = require('./connection');

async function seed() {
  const client = await pool.connect();
  console.log('Seeding database with component library data...');

  try {
    await client.query('BEGIN');

    // Clear existing data (reverse FK order)
    const tables = [
      'lib_busbars', 'lib_protection_relays', 'lib_voltage_transformers',
      'lib_current_transformers', 'lib_fuses', 'lib_disconnectors',
      'lib_circuit_breakers', 'lib_motors', 'lib_generators',
      'lib_lines', 'lib_cables', 'lib_transformers',
      'manufacturers', 'component_categories'
    ];
    for (const t of tables) await client.query(`DELETE FROM ${t}`);

    // ── Categories ──
    await client.query(`INSERT INTO component_categories (name, description) VALUES
      ('Transformers', 'Power and distribution transformers'),
      ('Cables', 'Underground and submarine power cables'),
      ('Lines', 'Overhead transmission line conductors'),
      ('Generators', 'Synchronous and asynchronous generators'),
      ('Motors', 'Induction and synchronous motors'),
      ('Circuit Breakers', 'MV and HV circuit breakers'),
      ('Disconnectors', 'Isolators and disconnect switches'),
      ('Fuses', 'HV and MV fuse links'),
      ('Current Transformers', 'Measurement and protection CTs'),
      ('Voltage Transformers', 'Measurement and protection VTs/PTs'),
      ('Protection Relays', 'Numerical protection relays'),
      ('Busbars', 'Bus bar systems')
    `);

    // ── Manufacturers ──
    const mfrsResult = await client.query(`INSERT INTO manufacturers (name, country, website) VALUES
      ('ABB', 'Switzerland', 'https://new.abb.com'),
      ('Siemens', 'Germany', 'https://www.siemens.com'),
      ('Schneider Electric', 'France', 'https://www.se.com'),
      ('GE Vernova', 'USA', 'https://www.gevernova.com'),
      ('Eaton', 'Ireland', 'https://www.eaton.com'),
      ('Nexans', 'France', 'https://www.nexans.com'),
      ('Prysmian', 'Italy', 'https://www.prysmian.com'),
      ('WEG', 'Brazil', 'https://www.weg.net'),
      ('Nidec', 'Japan', 'https://www.nidec.com'),
      ('Southwire', 'USA', 'https://www.southwire.com')
    RETURNING id, name`);

    const m = {};
    mfrsResult.rows.forEach(r => { m[r.name] = r.id; });
    console.log('Manufacturers:', Object.keys(m).join(', '));

    // ══════════════════════════════════════════════
    // TRANSFORMERS — ABB, Siemens, Schneider, GE
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_transformers
      (manufacturer_id, model, type, rated_power_mva, primary_voltage_kv, secondary_voltage_kv, tertiary_voltage_kv,
       impedance_pct, no_load_loss_kw, load_loss_kw, no_load_current_pct, tap_range_pct, vector_group, cooling_type) VALUES
      -- ABB 2-Winding
      ($1, 'ABB TrafoStar 500kVA',    '2W', 0.5,   11,    0.4,  NULL, 4.5,   1.1,   6.5,   2.8,  '±5%',    'Dyn11', 'ONAN'),
      ($1, 'ABB TrafoStar 1MVA',      '2W', 1.0,   11,    0.4,  NULL, 5.0,   1.8,   11.0,  2.3,  '±5%',    'Dyn11', 'ONAN'),
      ($1, 'ABB TrafoStar 2.5MVA',    '2W', 2.5,   33,    11,   NULL, 6.5,   3.5,   22.0,  1.8,  '±10%',   'Dyn11', 'ONAN'),
      ($1, 'ABB PowerStar 10MVA',     '2W', 10,    33,    11,   NULL, 8.0,   9.5,   58.0,  1.2,  '±10%',   'YNd11', 'ONAN/ONAF'),
      ($1, 'ABB PowerStar 40MVA',     '2W', 40,    132,   33,   NULL, 12.5,  22.0,  175.0, 0.8,  '±12.5%', 'YNd11', 'ONAN/ONAF'),
      ($1, 'ABB PowerStar 100MVA',    '2W', 100,   220,   132,  NULL, 14.0,  42.0,  350.0, 0.5,  '±15%',   'YNa0',  'OFAF'),
      -- ABB 3-Winding
      ($1, 'ABB PowerStar 60MVA 3W',  '3W', 60,    132,   33,   11,   12.0,  30.0,  210.0, 0.7,  '±12.5%', 'YNyn0d11', 'ONAN/ONAF'),
      ($1, 'ABB PowerStar 120MVA 3W', '3W', 120,   220,   132,  33,   14.5,  50.0,  420.0, 0.5,  '±15%',   'YNyn0d11', 'OFAF'),

      -- Siemens 2-Winding
      ($2, 'Siemens GEAFOL 630kVA',   '2W', 0.63,  11,    0.4,  NULL, 4.0,   1.3,   7.2,   2.5,  '±5%',    'Dyn11', 'AN'),
      ($2, 'Siemens GEAFOL 1.25MVA',  '2W', 1.25,  11,    0.4,  NULL, 5.5,   2.0,   12.5,  2.0,  '±5%',    'Dyn11', 'AN'),
      ($2, 'Siemens TUNORMA 5MVA',    '2W', 5.0,   33,    11,   NULL, 7.0,   5.5,   33.0,  1.5,  '±10%',   'Dyn11', 'ONAN'),
      ($2, 'Siemens TUNORMA 20MVA',   '2W', 20,    66,    11,   NULL, 9.5,   14.0,  95.0,  1.0,  '±10%',   'YNd11', 'ONAN/ONAF'),
      ($2, 'Siemens TUNORMA 63MVA',   '2W', 63,    132,   33,   NULL, 12.0,  28.0,  220.0, 0.7,  '±12.5%', 'YNd11', 'ONAN/ONAF'),
      ($2, 'Siemens TUNORMA 150MVA',  '2W', 150,   275,   132,  NULL, 15.0,  55.0,  480.0, 0.4,  '±15%',   'YNa0',  'OFAF'),
      -- Siemens 3-Winding
      ($2, 'Siemens TUNORMA 90MVA 3W','3W', 90,    132,   33,   11,   12.5,  38.0,  300.0, 0.6,  '±12.5%', 'YNyn0d11', 'ONAN/ONAF'),

      -- Schneider Electric 2-Winding
      ($3, 'Schneider Trihal 400kVA',  '2W', 0.4,  11,   0.4,  NULL, 4.5,  0.9,   5.0,   3.0,  '±5%',    'Dyn11', 'AN'),
      ($3, 'Schneider Trihal 1MVA',    '2W', 1.0,  11,   0.4,  NULL, 5.0,  1.7,   10.5,  2.2,  '±5%',    'Dyn11', 'AN'),
      ($3, 'Schneider Minera 3.15MVA', '2W', 3.15, 33,   11,   NULL, 6.5,  4.0,   24.0,  1.7,  '±10%',   'Dyn11', 'ONAN'),
      ($3, 'Schneider Minera 15MVA',   '2W', 15,   66,   11,   NULL, 9.0,  12.0,  82.0,  0.9,  '±10%',   'YNd11', 'ONAN/ONAF'),
      ($3, 'Schneider Minera 50MVA',   '2W', 50,   132,  33,   NULL, 12.5, 25.0,  190.0, 0.7,  '±12.5%', 'YNd11', 'ONAN/ONAF'),

      -- GE Vernova 2-Winding
      ($4, 'GE Prolec 500kVA',      '2W', 0.5,  11,    0.4,  NULL, 4.5,  1.2,   6.8,   2.7,  '±5%',    'Dyn11', 'ONAN'),
      ($4, 'GE Prolec 1.6MVA',      '2W', 1.6,  11,    0.4,  NULL, 5.5,  2.3,   14.5,  2.0,  '±5%',    'Dyn11', 'ONAN'),
      ($4, 'GE Prolec 7.5MVA',      '2W', 7.5,  33,    11,   NULL, 7.5,  7.5,   48.0,  1.3,  '±10%',   'YNd11', 'ONAN'),
      ($4, 'GE Prolec 31.5MVA',     '2W', 31.5, 132,   33,   NULL, 11.0, 18.0,  145.0, 0.8,  '±12.5%', 'YNd11', 'ONAN/ONAF'),
      ($4, 'GE Prolec 80MVA',       '2W', 80,   220,   132,  NULL, 13.0, 35.0,  290.0, 0.6,  '±15%',   'YNa0',  'OFAF'),
      -- GE 3-Winding
      ($4, 'GE Prolec 75MVA 3W',    '3W', 75,   132,   33,   11,   12.0, 32.0,  260.0, 0.65, '±12.5%', 'YNyn0d11', 'ONAN/ONAF')
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['GE Vernova']]);
    console.log('  Transformers seeded');

    // ══════════════════════════════════════════════
    // CABLES — Nexans, Prysmian, ABB, Southwire
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_cables
      (manufacturer_id, model, voltage_rating_kv, conductor_size_mm2, conductor_material, cores,
       resistance_ohm_per_km, reactance_ohm_per_km, capacitance_uf_per_km, ampacity_a,
       insulation_type, short_circuit_rating_ka, outer_diameter_mm, weight_kg_per_km) VALUES
      -- Nexans Cu
      ($1, 'Nexans N2XSY 1x50',      11,  50,   'Cu', 1, 0.387,  0.135, 0.18,  170,  'XLPE', 6.5,  28,  1650),
      ($1, 'Nexans N2XSY 1x95',      11,  95,   'Cu', 1, 0.193,  0.118, 0.22,  275,  'XLPE', 12.3, 33,  2500),
      ($1, 'Nexans N2XSY 1x185',     11,  185,  'Cu', 1, 0.099,  0.105, 0.28,  415,  'XLPE', 24.0, 40,  3900),
      ($1, 'Nexans N2XSY 1x300',     11,  300,  'Cu', 1, 0.060,  0.097, 0.33,  545,  'XLPE', 38.8, 47,  5600),
      ($1, 'Nexans N2XSY 1x500',     11,  500,  'Cu', 1, 0.037,  0.089, 0.39,  700,  'XLPE', 64.7, 55,  8400),
      ($1, 'Nexans N2XS(F)2Y 1x240', 33,  240,  'Cu', 1, 0.075,  0.113, 0.16,  490,  'XLPE', 31.1, 58,  6200),
      ($1, 'Nexans N2XS(F)2Y 1x500', 33,  500,  'Cu', 1, 0.037,  0.101, 0.20,  710,  'XLPE', 64.7, 70,  9800),
      ($1, 'Nexans 2XS(FL)2Y 1x630', 132, 630,  'Cu', 1, 0.028,  0.116, 0.17,  810,  'XLPE', 81.5, 105, 18500),
      -- Nexans Al
      ($1, 'Nexans NA2XSY 1x150',    11,  150,  'Al', 1, 0.206,  0.110, 0.24,  300,  'XLPE', 12.0, 38,  2100),
      ($1, 'Nexans NA2XSY 1x300',    11,  300,  'Al', 1, 0.100,  0.098, 0.30,  440,  'XLPE', 24.0, 46,  3200),
      -- Prysmian
      ($2, 'Prysmian FP-PLUS 1x70',   11,  70,   'Cu', 1, 0.268,  0.128, 0.20,  220,  'XLPE', 9.1,  30,  2000),
      ($2, 'Prysmian FP-PLUS 1x120',  11,  120,  'Cu', 1, 0.153,  0.114, 0.24,  330,  'XLPE', 15.5, 35,  2900),
      ($2, 'Prysmian FP-PLUS 1x240',  11,  240,  'Cu', 1, 0.075,  0.101, 0.30,  480,  'XLPE', 31.1, 43,  4700),
      ($2, 'Prysmian FP-PLUS 1x400',  11,  400,  'Cu', 1, 0.047,  0.093, 0.35,  630,  'XLPE', 51.8, 51,  7000),
      ($2, 'Prysmian FG7H1OR 3x95',   0.6, 95,   'Cu', 3, 0.193,  0.080, 0.30,  230,  'XLPE', 12.3, 48,  4500),
      ($2, 'Prysmian FG7H1OR 3x185',  0.6, 185,  'Cu', 3, 0.099,  0.075, 0.38,  365,  'XLPE', 24.0, 60,  7200),
      ($2, 'Prysmian E-XHI 1x400',    33,  400,  'Cu', 1, 0.047,  0.108, 0.18,  640,  'XLPE', 51.8, 65,  8500),
      ($2, 'Prysmian E-XHI 1x800',    132, 800,  'Cu', 1, 0.022,  0.112, 0.18,  900,  'XLPE', 103.5,112, 22000),
      -- ABB Cables
      ($3, 'ABB XLPE 1x50',           11,  50,   'Cu', 1, 0.387,  0.136, 0.17,  165,  'XLPE', 6.5,  27,  1600),
      ($3, 'ABB XLPE 1x150',          11,  150,  'Cu', 1, 0.124,  0.110, 0.25,  370,  'XLPE', 19.4, 37,  3400),
      ($3, 'ABB XLPE 1x300',          11,  300,  'Cu', 1, 0.060,  0.097, 0.32,  540,  'XLPE', 38.8, 46,  5500),
      ($3, 'ABB XLPE 1x630',          33,  630,  'Cu', 1, 0.028,  0.098, 0.21,  780,  'XLPE', 81.5, 73,  11500),
      ($3, 'ABB XLPE 1x1000',         132, 1000, 'Cu', 1, 0.018,  0.110, 0.19,  950,  'XLPE', 129.4,120, 26000),
      -- Southwire
      ($4, 'Southwire MV-105 1x2/0',  15,  67.4, 'Cu', 1, 0.265,  0.130, 0.19,  210,  'EPR', 8.7,  31,  1850),
      ($4, 'Southwire MV-105 1x4/0',  15,  107.2,'Cu', 1, 0.167,  0.118, 0.22,  295,  'EPR', 13.9, 35,  2600),
      ($4, 'Southwire MV-105 1x350',  15,  177.3,'Cu', 1, 0.100,  0.108, 0.26,  395,  'EPR', 22.9, 41,  3700),
      ($4, 'Southwire MV-105 1x500',  15,  253.4,'Cu', 1, 0.070,  0.100, 0.30,  490,  'EPR', 32.8, 47,  5000),
      ($4, 'Southwire MV-105 1x750',  15,  380.0,'Al', 1, 0.047,  0.095, 0.34,  445,  'EPR', 30.4, 53,  3800)
    `, [m['Nexans'], m['Prysmian'], m['ABB'], m['Southwire']]);
    console.log('  Cables seeded');

    // ══════════════════════════════════════════════
    // TRANSMISSION LINES — Nexans, Prysmian, Southwire, ABB
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_lines
      (manufacturer_id, model, conductor_type, voltage_rating_kv, cross_section_mm2,
       resistance_ohm_per_km, reactance_ohm_per_km, susceptance_us_per_km, ampacity_a,
       sil_mw, diameter_mm, weight_kg_per_km, breaking_load_kn) VALUES
      -- Nexans ACSR
      ($1, 'Nexans Hawk',       'ACSR', 66,  281, 0.1147, 0.395, 2.82, 660,  NULL, 21.8, 975,  79.9),
      ($1, 'Nexans Drake',      'ACSR', 132, 469, 0.0688, 0.375, 2.96, 900,  135,  28.1, 1627, 133.5),
      ($1, 'Nexans Cardinal',   'ACSR', 220, 546, 0.0590, 0.365, 3.02, 995,  200,  30.4, 1895, 155.7),
      ($1, 'Nexans Bittern',    'ACSR', 275, 645, 0.0500, 0.358, 3.08, 1080, 270,  33.0, 2239, 183.7),
      -- Prysmian ACSR
      ($2, 'Prysmian Panther',  'ACSR', 66,  261, 0.1230, 0.400, 2.78, 620,  NULL, 21.0, 908,  74.3),
      ($2, 'Prysmian Zebra',    'ACSR', 132, 428, 0.0754, 0.380, 2.92, 835,  125,  28.6, 1621, 131.9),
      ($2, 'Prysmian Moose',    'ACSR', 220, 597, 0.0540, 0.362, 3.05, 1035, 215,  31.8, 2004, 163.2),
      ($2, 'Prysmian Bersimis', 'ACSR', 400, 709, 0.0456, 0.328, 3.42, 1150, 480,  35.1, 2416, 199.4),
      -- Southwire ACSR
      ($3, 'Southwire Condor',   'ACSR', 66,  455, 0.0710, 0.378, 2.94, 880,  NULL, 27.7, 1524, 122.5),
      ($3, 'Southwire Grosbeak', 'ACSR', 132, 375, 0.0861, 0.390, 2.86, 755,  110,  25.1, 1259, 100.4),
      ($3, 'Southwire Bluejay',  'ACSR', 220, 564, 0.0573, 0.363, 3.04, 1005, 210,  31.0, 1891, 154.5),
      ($3, 'Southwire Falcon',   'ACSR', 400, 908, 0.0355, 0.320, 3.50, 1340, 500,  39.3, 3048, 263.9),
      -- ABB HTLS (ACCC)
      ($4, 'ABB ACCC Dublin',     'ACCC', 132, 468, 0.0387, 0.355, 3.05, 1200, 160,  28.1, 1180, 174.0),
      ($4, 'ABB ACCC Casablanca', 'ACCC', 220, 607, 0.0299, 0.340, 3.15, 1500, 285,  32.0, 1530, 226.0),
      ($4, 'ABB ACCC London',     'ACCC', 400, 817, 0.0222, 0.325, 3.35, 1800, 520,  37.0, 2058, 304.0)
    `, [m['Nexans'], m['Prysmian'], m['Southwire'], m['ABB']]);
    console.log('  Transmission lines seeded');

    // ══════════════════════════════════════════════
    // GENERATORS — ABB, Siemens, GE Vernova, Schneider
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_generators
      (manufacturer_id, model, type, rated_power_mva, rated_voltage_kv, power_factor, frequency_hz,
       speed_rpm, poles, xd_sync_pu, xd_trans_pu, xd_subtrans_pu, x0_pu, x2_pu, inertia_constant_h) VALUES
      ($1, 'ABB AMG 0800',      'Synchronous', 2.5,   6.6,  0.80, 50, 1500, 4,  1.80, 0.30, 0.20, 0.05, 0.19, 1.5),
      ($1, 'ABB AMG 1600',      'Synchronous', 25,    11,   0.85, 50, 1500, 4,  1.95, 0.32, 0.22, 0.06, 0.21, 3.0),
      ($1, 'ABB AMG 3150',      'Synchronous', 75,    11,   0.85, 50, 3000, 2,  2.10, 0.35, 0.25, 0.08, 0.23, 4.5),
      ($1, 'ABB AMG 5000',      'Synchronous', 200,   15.75,0.85, 50, 3000, 2,  2.20, 0.38, 0.28, 0.10, 0.26, 5.0),
      ($2, 'Siemens SGen5-100A',  'Synchronous', 5,     6.6,  0.80, 50, 1500, 4,  1.85, 0.28, 0.18, 0.05, 0.17, 1.8),
      ($2, 'Siemens SGen5-1000A', 'Synchronous', 30,    11,   0.85, 50, 1500, 4,  2.00, 0.33, 0.23, 0.07, 0.22, 3.2),
      ($2, 'Siemens SGen5-2000A', 'Synchronous', 100,   13.8, 0.85, 50, 3000, 2,  2.15, 0.36, 0.26, 0.09, 0.24, 4.8),
      ($2, 'Siemens SGen5-3000A', 'Synchronous', 350,   20,   0.85, 50, 3000, 2,  2.25, 0.40, 0.30, 0.11, 0.28, 5.5),
      ($3, 'GE Jenbacher J620',  'Synchronous', 3.3,   6.6,  0.80, 50, 1500, 4,  1.78, 0.29, 0.19, 0.05, 0.18, 1.6),
      ($3, 'GE 7HA.03',          'Synchronous', 430,   22,   0.85, 50, 3000, 2,  2.30, 0.42, 0.32, 0.12, 0.30, 6.0),
      ($3, 'GE 9HA.02',          'Synchronous', 620,   24,   0.90, 50, 3000, 2,  2.35, 0.45, 0.34, 0.13, 0.32, 6.5),
      ($3, 'GE LM6000',          'Synchronous', 55,    13.8, 0.85, 50, 3600, 2,  2.05, 0.34, 0.24, 0.08, 0.22, 4.0),
      ($4, 'LS LSA 46.3',  'Synchronous', 0.5,  0.4,  0.80, 50, 1500, 4,  1.70, 0.25, 0.15, 0.04, 0.14, 1.2),
      ($4, 'LS LSA 50.2',  'Synchronous', 2.0,  6.6,  0.80, 50, 1500, 4,  1.82, 0.28, 0.18, 0.05, 0.17, 1.8),
      ($4, 'LS LSA 53',    'Synchronous', 15,   11,   0.85, 50, 1500, 4,  1.92, 0.31, 0.21, 0.06, 0.20, 2.8),
      ($4, 'LS LSA 56',    'Synchronous', 50,   11,   0.85, 50, 3000, 2,  2.08, 0.35, 0.25, 0.08, 0.23, 4.2)
    `, [m['ABB'], m['Siemens'], m['GE Vernova'], m['Schneider Electric']]);
    console.log('  Generators seeded');

    // ══════════════════════════════════════════════
    // MOTORS — ABB, Siemens, WEG, Nidec
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_motors
      (manufacturer_id, model, type, rated_power_kw, rated_voltage_kv, full_load_current_a,
       efficiency_pct, power_factor, locked_rotor_current_pu, starting_torque_pct,
       speed_rpm, poles, frame_size) VALUES
      ($1, 'ABB M3BP 160',    'Induction', 15,    0.4,   28.5,  93.0, 0.86, 7.0, 200, 1475, 4, '160M'),
      ($1, 'ABB M3BP 280',    'Induction', 90,    0.4,   163,   95.4, 0.87, 7.5, 180, 1485, 4, '280S'),
      ($1, 'ABB M3BP 355',    'Induction', 315,   0.4,   555,   96.2, 0.88, 6.8, 160, 1490, 4, '355M'),
      ($1, 'ABB AXR 450',     'Induction', 1000,  6.6,   102,   96.8, 0.89, 6.5, 150, 1492, 4, '450'),
      ($1, 'ABB AXR 560',     'Induction', 5000,  6.6,   505,   97.2, 0.90, 6.0, 140, 1494, 4, '560'),
      ($1, 'ABB AMS 710',     'Synchronous', 10000, 11, 610,   97.8, 0.90, 5.5, 130, 1500, 4, '710'),
      ($2, 'Siemens 1LE1 160',   'Induction', 18.5,  0.4,   35.0,  93.5, 0.86, 7.2, 210, 1470, 4, '160L'),
      ($2, 'Siemens 1LE1 280',   'Induction', 110,   0.4,   198,   95.6, 0.87, 7.8, 175, 1483, 4, '280M'),
      ($2, 'Siemens 1LE1 355',   'Induction', 400,   0.4,   700,   96.5, 0.88, 7.0, 165, 1488, 4, '355L'),
      ($2, 'Siemens H-compact',  'Induction', 2000,  6.6,   202,   97.0, 0.89, 6.2, 145, 1493, 4, '500'),
      ($2, 'Siemens H-modyn',    'Synchronous', 8000, 11,  485,   97.5, 0.90, 5.5, 135, 1500, 4, '630'),
      ($3, 'WEG W22 160',      'Induction', 15,    0.4,   28.8,  92.8, 0.85, 7.0, 195, 1475, 4, '160M'),
      ($3, 'WEG W22 280',      'Induction', 75,    0.4,   137,   95.0, 0.86, 7.5, 180, 1480, 4, '280S'),
      ($3, 'WEG W22 355',      'Induction', 250,   0.4,   440,   96.0, 0.87, 6.5, 160, 1488, 4, '355M'),
      ($3, 'WEG HGF',          'Induction', 3000,  6.6,   304,   96.8, 0.88, 6.0, 140, 1492, 4, '560'),
      ($3, 'WEG MGF',          'Induction', 8000,  11,    485,   97.2, 0.89, 5.8, 135, 1494, 4, '710'),
      ($4, 'Nidec Dyneo+ 160', 'Induction', 22,    0.4,   41.0,  93.2, 0.86, 7.0, 200, 1475, 4, '160L'),
      ($4, 'Nidec Dyneo+ 280', 'Induction', 132,   0.4,   238,   95.5, 0.87, 7.2, 175, 1484, 4, '280M'),
      ($4, 'Nidec Dyneo+ 355', 'Induction', 500,   0.4,   875,   96.4, 0.88, 6.8, 160, 1490, 4, '355L'),
      ($4, 'Nidec LSA HV',     'Induction', 4000,  6.6,   405,   97.0, 0.89, 6.0, 145, 1493, 4, '560'),
      ($4, 'Nidec LSAH HV',    'Synchronous', 12000, 11, 730,   97.8, 0.90, 5.5, 130, 1500, 4, '800')
    `, [m['ABB'], m['Siemens'], m['WEG'], m['Nidec']]);
    console.log('  Motors seeded');

    // ══════════════════════════════════════════════
    // CIRCUIT BREAKERS — ABB, Siemens, Schneider, Eaton
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_circuit_breakers
      (manufacturer_id, model, type, rated_voltage_kv, rated_current_a, breaking_capacity_ka,
       making_capacity_ka, operating_mechanism, short_time_withstand_ka, closing_time_ms, opening_time_ms) VALUES
      ($1, 'ABB Emax2 E2.2',       'ACB',  0.69,  2500,  65,   143,  'Motorized',    65,   70,  30),
      ($1, 'ABB SACE Tmax XT7',    'MCCB', 0.69,  1250,  50,   105,  'Motor/Manual', 50,  NULL, NULL),
      ($1, 'ABB VD4',              'VCB',  12,    2500,  40,   100,  'Spring',       40,   65,  55),
      ($1, 'ABB VD4-AF',           'VCB',  17.5,  3150,  40,   100,  'Spring',       40,   60,  50),
      ($1, 'ABB HD4',              'SF6',  36,    2500,  25,   63,   'Spring',       25,   70,  55),
      ($1, 'ABB LTB 145D1/B',     'SF6',  145,   3150,  40,   100,  'Spring',       40,   55,  25),
      ($1, 'ABB LTB 245E1',       'SF6',  245,   4000,  50,   125,  'Spring',       50,   50,  22),
      ($2, 'Siemens WL2500',      'ACB',  0.69,  2500,  65,   143,  'Motorized',    65,   65,  28),
      ($2, 'Siemens 3VA 1250',    'MCCB', 0.69,  1250,  50,   105,  'Motor/Manual', 50,  NULL, NULL),
      ($2, 'Siemens SION 3AE5',   'VCB',  12,    2500,  40,   100,  'Spring',       40,   60,  50),
      ($2, 'Siemens NXAIR 3AH5',  'VCB',  17.5,  4000,  50,   125,  'Spring',       50,   55,  45),
      ($2, 'Siemens 3AH37',       'VCB',  36,    2500,  25,   63,   'Spring',       25,   65,  50),
      ($2, 'Siemens 3AP1 FG',     'SF6',  145,   3150,  40,   100,  'Spring',       40,   52,  23),
      ($2, 'Siemens 3AP2 FI',     'SF6',  245,   4000,  63,   158,  'Spring',       63,   48,  20),
      ($3, 'Schneider MasterPact MTZ2',  'ACB',  0.69,  2500,  65,   143,  'Motorized',    65,   68,  30),
      ($3, 'Schneider NSX1250',          'MCCB', 0.69,  1250,  50,   105,  'Motor/Manual', 50,  NULL, NULL),
      ($3, 'Schneider Evolis',           'VCB',  12,    2500,  40,   100,  'Spring',       40,   58,  48),
      ($3, 'Schneider HVX',              'VCB',  17.5,  3150,  40,   100,  'Spring',       40,   55,  48),
      ($3, 'Schneider Fluarc FG2',       'SF6',  36,    2500,  25,   63,   'Spring',       25,   68,  52),
      ($3, 'Schneider GL312F',           'SF6',  145,   3150,  40,   100,  'Spring',       40,   55,  24),
      ($4, 'Eaton Magnum DS',     'ACB',  0.69,  2000,  65,   143,  'Motorized',    65,   70,  32),
      ($4, 'Eaton NZM4-1250',     'MCCB', 0.69,  1250,  50,   105,  'Motor/Manual', 50,  NULL, NULL),
      ($4, 'Eaton VCP-W 25',      'VCB',  15,    2500,  40,   100,  'Spring',       40,   60,  50),
      ($4, 'Eaton VCP-W 38',      'VCB',  38,    2000,  25,   63,   'Spring',       25,   65,  55)
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['Eaton']]);
    console.log('  Circuit breakers seeded');

    // ══════════════════════════════════════════════
    // DISCONNECTORS — ABB, Siemens, Schneider, Eaton
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_disconnectors
      (manufacturer_id, model, type, rated_voltage_kv, rated_current_a,
       short_time_withstand_ka, peak_withstand_ka, insulation_level_kv, operating_mechanism) VALUES
      ($1, 'ABB SGC 12',          'Indoor',    12,   1250,  25,  63,   28,   'Manual/Motor'),
      ($1, 'ABB SDF 36',          'Indoor',    36,   2000,  25,  63,   70,   'Motor'),
      ($1, 'ABB SGF 145',         'Outdoor',   145,  3150,  40,  100,  275,  'Motor'),
      ($1, 'ABB SGF 245',         'Outdoor',   245,  4000,  50,  125,  460,  'Motor'),
      ($2, 'Siemens 3DC 12',     'Indoor',    12,   1250,  25,  63,   28,   'Manual/Motor'),
      ($2, 'Siemens 3DC 36',     'Indoor',    36,   2000,  25,  63,   70,   'Motor'),
      ($2, 'Siemens 3DE 145',    'Outdoor',   145,  3150,  40,  100,  275,  'Motor'),
      ($2, 'Siemens 3DE 245',    'Outdoor',   245,  4000,  63,  158,  460,  'Motor'),
      ($3, 'Schneider Interpact INS 12', 'Indoor',  12,  1250, 25, 63,   28,  'Manual/Motor'),
      ($3, 'Schneider Interpact INS 36', 'Indoor',  36,  2000, 25, 63,   70,  'Motor'),
      ($3, 'Schneider GOAB 145',         'Outdoor', 145, 3150, 40, 100,  275, 'Motor'),
      ($4, 'Eaton GL 12',        'Indoor',    12,   1250,  25,  63,   28,   'Manual/Motor'),
      ($4, 'Eaton GL 36',        'Indoor',    36,   1600,  25,  63,   70,   'Motor'),
      ($4, 'Eaton V-S 145',      'Outdoor',   145,  2500,  40,  100,  275,  'Motor')
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['Eaton']]);
    console.log('  Disconnectors seeded');

    // ══════════════════════════════════════════════
    // FUSES — ABB, Siemens, Schneider, Eaton
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_fuses
      (manufacturer_id, model, type, rated_voltage_kv, rated_current_a, breaking_capacity_ka,
       i2t_min, i2t_max, fuse_class) VALUES
      ($1, 'ABB CMF 6A',      'HRC', 12,   6,    50,   2.5,    30,      'Back-up'),
      ($1, 'ABB CMF 25A',     'HRC', 12,   25,   50,   45,     500,     'Back-up'),
      ($1, 'ABB CMF 63A',     'HRC', 12,   63,   50,   280,    3200,    'Back-up'),
      ($1, 'ABB CMF 100A',    'HRC', 12,   100,  50,   700,    8000,    'Back-up'),
      ($1, 'ABB CEF 36',      'HRC', 36,   50,   40,   180,    2000,    'Back-up'),
      ($2, 'Siemens 3GD1 6A',   'HRC', 12,   6,    50,   2.8,    32,      'Back-up'),
      ($2, 'Siemens 3GD1 25A',  'HRC', 12,   25,   50,   48,     520,     'Back-up'),
      ($2, 'Siemens 3GD1 63A',  'HRC', 12,   63,   50,   300,    3400,    'Back-up'),
      ($2, 'Siemens 3GD1 100A', 'HRC', 12,   100,  50,   750,    8500,    'Back-up'),
      ($2, 'Siemens 3GD2 50A',  'HRC', 36,   50,   40,   190,    2100,    'Back-up'),
      ($3, 'Schneider Fusarc CF 6A',   'HRC', 12,  6,   50,  2.4,   28,     'Back-up'),
      ($3, 'Schneider Fusarc CF 25A',  'HRC', 12,  25,  50,  42,    480,    'Back-up'),
      ($3, 'Schneider Fusarc CF 63A',  'HRC', 12,  63,  50,  270,   3100,   'Back-up'),
      ($3, 'Schneider Fusarc CF 100A', 'HRC', 12,  100, 50,  680,   7800,   'Back-up'),
      ($4, 'Eaton Bussmann 6A',   'HRC', 12,  6,    50,  2.6,   30,     'Back-up'),
      ($4, 'Eaton Bussmann 25A',  'HRC', 12,  25,   50,  46,    510,    'Back-up'),
      ($4, 'Eaton Bussmann 63A',  'HRC', 12,  63,   50,  290,   3300,   'Back-up'),
      ($4, 'Eaton Bussmann 100A', 'HRC', 12,  100,  50,  720,   8200,   'Back-up'),
      ($4, 'Eaton Bussmann 200A', 'HRC', 12,  200,  50,  2800,  32000,  'Full-range')
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['Eaton']]);
    console.log('  Fuses seeded');

    // ══════════════════════════════════════════════
    // CURRENT TRANSFORMERS — ABB, Siemens, Schneider, GE
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_current_transformers
      (manufacturer_id, model, type, rated_voltage_kv, primary_current_a, secondary_current_a,
       accuracy_class, burden_va, alf, thermal_rating_ka_1s, dynamic_rating_ka) VALUES
      ($1, 'ABB TPU 24 100/5',    'Wound',   24,   100,  5, '0.5/5P20',  15,  20,  12.5, 31.5),
      ($1, 'ABB TPU 24 200/5',    'Wound',   24,   200,  5, '0.5/5P20',  15,  20,  25,   63),
      ($1, 'ABB TPU 24 600/5',    'Wound',   24,   600,  5, '0.5/5P20',  30,  20,  40,   100),
      ($1, 'ABB IMB 145 1200/5',  'Hairpin', 145,  1200, 5, '0.2/5P20',  30,  20,  40,   100),
      ($1, 'ABB IMB 245 2000/5',  'Hairpin', 245,  2000, 5, '0.2/5P20',  50,  20,  50,   125),
      ($2, 'Siemens 4MA72 100/5',   'Wound',   24,  100,  5, '0.5/5P20',  15, 20,  12.5, 31.5),
      ($2, 'Siemens 4MA72 300/5',   'Wound',   24,  300,  5, '0.5/5P20',  15, 20,  25,   63),
      ($2, 'Siemens 4MA72 800/5',   'Wound',   24,  800,  5, '0.5/5P20',  30, 20,  40,   100),
      ($2, 'Siemens 4MC85 1500/5',  'Hairpin', 145, 1500, 5, '0.2/5P20',  30, 20,  40,   100),
      ($2, 'Siemens 4MC85 2500/5',  'Hairpin', 245, 2500, 5, '0.2/5P20',  50, 20,  63,   158),
      ($3, 'Schneider IOSK 100/5',     'Wound',   24,  100,  5, '0.5/5P20', 15, 20, 12.5, 31.5),
      ($3, 'Schneider IOSK 400/5',     'Wound',   24,  400,  5, '0.5/5P20', 15, 20, 25,   63),
      ($3, 'Schneider IOSK 1000/5',    'Wound',   24,  1000, 5, '0.5/5P20', 30, 20, 40,   100),
      ($3, 'Schneider OSKF 145 1200/5','Hairpin', 145, 1200, 5, '0.2/5P20', 30, 20, 40,   100),
      ($4, 'GE JAK-12 100/5',   'Wound',   15,  100,  5, '0.3/5P20',  15, 20, 12.5, 31.5),
      ($4, 'GE JAK-12 300/5',   'Wound',   15,  300,  5, '0.3/5P20',  15, 20, 25,   63),
      ($4, 'GE JAK-12 600/5',   'Wound',   15,  600,  5, '0.3/5P20',  30, 20, 40,   100),
      ($4, 'GE IFK 145 2000/5', 'Hairpin', 145, 2000, 5, '0.2/5P20',  50, 20, 50,   125)
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['GE Vernova']]);
    console.log('  Current transformers seeded');

    // ══════════════════════════════════════════════
    // VOLTAGE TRANSFORMERS — ABB, Siemens, Schneider, GE
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_voltage_transformers
      (manufacturer_id, model, type, rated_primary_voltage_kv, rated_secondary_voltage_v,
       accuracy_class, burden_va, voltage_factor, thermal_limit_va, insulation_level_kv) VALUES
      ($1, 'ABB TJP6 11/0.11',     'Wound',       11,    110, '0.5/3P',  50,   '1.2/30s', 200,  28),
      ($1, 'ABB TJP6 33/0.11',     'Wound',       33,    110, '0.5/3P',  50,   '1.2/30s', 200,  70),
      ($1, 'ABB EMF 145/0.11',     'Inductive',   132,   110, '0.2/3P',  100,  '1.5/30s', 400,  275),
      ($1, 'ABB CVT 245',          'Capacitive',  220,   110, '0.5/3P',  200,  '1.5/30s', 500,  460),
      ($2, 'Siemens 4MR14 11/0.11',  'Wound',       11,   110, '0.5/3P',  50,  '1.2/30s', 200, 28),
      ($2, 'Siemens 4MR14 33/0.11',  'Wound',       33,   110, '0.5/3P',  50,  '1.2/30s', 200, 70),
      ($2, 'Siemens 4MU55 132/0.11', 'Inductive',   132,  110, '0.2/3P',  100, '1.5/30s', 400, 275),
      ($2, 'Siemens 4MC4 220/0.11',  'Capacitive',  220,  110, '0.5/3P',  200, '1.5/30s', 500, 460),
      ($3, 'Schneider VRQ2 11/0.11',  'Wound',     11,  110, '0.5/3P', 50,  '1.2/30s', 200, 28),
      ($3, 'Schneider VRQ2 33/0.11',  'Wound',     33,  110, '0.5/3P', 50,  '1.2/30s', 200, 70),
      ($3, 'Schneider VIP 145/0.11',  'Inductive', 132, 110, '0.2/3P', 100, '1.5/30s', 400, 275),
      ($4, 'GE JVT-150 11/0.11',   'Wound',       11,   110, '0.3/3P',  50,  '1.2/30s', 200, 28),
      ($4, 'GE JVT-150 33/0.11',   'Wound',       33,   110, '0.3/3P',  50,  '1.2/30s', 200, 70),
      ($4, 'GE JVTF-145 132/0.11', 'Inductive',   132,  110, '0.2/3P',  100, '1.5/30s', 400, 275),
      ($4, 'GE CVT-245 220/0.11',  'Capacitive',  220,  110, '0.5/3P',  200, '1.5/30s', 500, 460)
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['GE Vernova']]);
    console.log('  Voltage transformers seeded');

    // ══════════════════════════════════════════════
    // PROTECTION RELAYS — ABB, Siemens, Schneider, GE
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_protection_relays
      (manufacturer_id, model, function_code, type, ct_inputs, vt_inputs,
       binary_inputs, binary_outputs, communication, pickup_range, time_dial_range, curve_types) VALUES
      ($1, 'ABB REF615',         '50/51',   'Overcurrent',     3, 0, 8,  6,  'IEC 61850, Modbus, DNP3', '0.05-40xIn', '0.05-1.0',  'IEC SI/VI/EI/LTI, IEEE MI/VI/EI'),
      ($1, 'ABB RED615',         '87',      'Differential',    6, 0, 8,  6,  'IEC 61850, Modbus, DNP3', '0.1-1.0 pu', NULL,         NULL),
      ($1, 'ABB REL670',         '21',      'Distance',        3, 4, 16, 12, 'IEC 61850, Modbus, DNP3', 'Zone 1-5',   '0-60s',     'Mho, Quad, Offset Mho'),
      ($1, 'ABB REF615',         '51N',     'Earth Fault',     3, 0, 8,  6,  'IEC 61850, Modbus, DNP3', '0.01-8xIn',  '0.05-1.0',  'IEC SI/VI/EI/LTI'),
      ($1, 'ABB REM615',         '50BF',    'Breaker Failure', 3, 0, 8,  6,  'IEC 61850, Modbus',       '0.05-40xIn', '0.05-1.5s', NULL),
      ($2, 'Siemens 7SJ85',      '50/51',   'Overcurrent',     4, 0, 7,  5,  'IEC 61850, Modbus, DNP3', '0.05-35xIn', '0.05-1.0',  'IEC SI/VI/EI/LTI, ANSI MI/VI/EI'),
      ($2, 'Siemens 7UT87',      '87',      'Differential',    12,4, 14, 10, 'IEC 61850, Modbus, DNP3', '0.1-2.0 pu', NULL,         NULL),
      ($2, 'Siemens 7SA87',      '21',      'Distance',        4, 4, 14, 10, 'IEC 61850, Modbus, DNP3', 'Zone 1-5',   '0-60s',     'Mho, Quad, Offset Mho'),
      ($2, 'Siemens 7SJ85',      '51N',     'Earth Fault',     4, 0, 7,  5,  'IEC 61850, Modbus, DNP3', '0.01-10xIn', '0.05-1.0',  'IEC SI/VI/EI/LTI'),
      ($2, 'Siemens 7SJ85',      '50BF',    'Breaker Failure', 4, 0, 7,  5,  'IEC 61850, Modbus',       '0.05-35xIn', '0.1-2.0s',  NULL),
      ($3, 'Schneider Sepam 80',   '50/51',   'Overcurrent',     3, 0, 10, 5, 'IEC 61850, Modbus',       '0.1-24xIn',  '0.05-1.0',  'IEC SI/VI/EI/LTI, IEEE MI/VI/EI'),
      ($3, 'Schneider Sepam 87',   '87',      'Differential',    6, 0, 10, 5, 'IEC 61850, Modbus',       '0.1-1.5 pu', NULL,         NULL),
      ($3, 'Schneider MiCOM P443', '21',      'Distance',        3, 4, 12, 8, 'IEC 61850, Modbus, DNP3', 'Zone 1-4',   '0-100s',    'Mho, Quad'),
      ($3, 'Schneider Sepam 80',   '51N',     'Earth Fault',     3, 0, 10, 5, 'IEC 61850, Modbus',       '0.01-8xIn',  '0.05-1.0',  'IEC SI/VI/EI/LTI'),
      ($4, 'GE Multilin 750/760', '50/51',   'Overcurrent',     4, 0, 12, 8,  'IEC 61850, Modbus, DNP3', '0.05-20xIn', '0.05-1.0',  'IEC SI/VI/EI/LTI, IEEE U1-U5'),
      ($4, 'GE Multilin 845',     '87',      'Differential',    12,4, 16, 10, 'IEC 61850, Modbus, DNP3', '0.1-2.0 pu', NULL,         NULL),
      ($4, 'GE Multilin D60',     '21',      'Distance',        4, 4, 16, 12, 'IEC 61850, Modbus, DNP3', 'Zone 1-5',   '0-100s',    'Mho, Quad, Reactance'),
      ($4, 'GE Multilin 750/760', '51N',     'Earth Fault',     4, 0, 12, 8,  'IEC 61850, Modbus, DNP3', '0.01-10xIn', '0.05-1.0',  'IEC SI/VI/EI/LTI'),
      ($4, 'GE Multilin F35',     '50BF',    'Breaker Failure', 4, 0, 8,  6,  'IEC 61850, Modbus',       '0.05-20xIn', '0.1-2.0s',  NULL)
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['GE Vernova']]);
    console.log('  Protection relays seeded');

    // ══════════════════════════════════════════════
    // BUSBARS — ABB, Siemens, Schneider, Eaton
    // ══════════════════════════════════════════════
    await client.query(`INSERT INTO lib_busbars
      (manufacturer_id, model, type, rated_voltage_kv, rated_current_a, material,
       dimensions_mm, short_time_withstand_ka, peak_withstand_ka, ip_rating) VALUES
      ($1, 'ABB Rittal SV 1250',    'Enclosed',    0.69,  1250,  'Copper',    '60x10',    25,  63,  'IP54'),
      ($1, 'ABB Rittal SV 2500',    'Enclosed',    0.69,  2500,  'Copper',    '80x10',    40,  100, 'IP54'),
      ($1, 'ABB Rittal SV 4000',    'Enclosed',    0.69,  4000,  'Copper',    '100x10x2', 50,  125, 'IP54'),
      ($1, 'ABB UniGear ZS1 Bus',   'Metal-Clad',  12,    2500,  'Copper',    '80x10',    40,  100, 'IP4X'),
      ($1, 'ABB ELK-14 Bus',        'GIS',         145,   3150,  'Aluminium', 'Tubular',  40,  100, NULL),
      ($2, 'Siemens SIVACON S8 1250', 'Enclosed',    0.69,  1250,  'Copper',    '60x10',    25,  63,  'IP55'),
      ($2, 'Siemens SIVACON S8 2500', 'Enclosed',    0.69,  2500,  'Copper',    '80x10',    40,  100, 'IP55'),
      ($2, 'Siemens SIVACON S8 5000', 'Enclosed',    0.69,  5000,  'Copper',    '100x10x3', 65,  158, 'IP55'),
      ($2, 'Siemens NXAIR Bus',       'Metal-Clad',  12,    3150,  'Copper',    '100x10',   50,  125, 'IP4X'),
      ($2, 'Siemens 8DQ1 Bus',        'GIS',         245,   4000,  'Aluminium', 'Tubular',  63,  158, NULL),
      ($3, 'Schneider Prisma P 1250',    'Enclosed',    0.69, 1250, 'Copper',    '60x10',    25, 63,  'IP55'),
      ($3, 'Schneider Prisma P 3200',    'Enclosed',    0.69, 3200, 'Copper',    '80x10x2',  40, 100, 'IP55'),
      ($3, 'Schneider MCset Bus',        'Metal-Clad',  12,   2500, 'Copper',    '80x10',    40, 100, 'IP4X'),
      ($3, 'Schneider GHA Bus',          'GIS',         145,  3150, 'Aluminium', 'Tubular',  40, 100, NULL),
      ($4, 'Eaton Pow-R-Way III 1200',  'Enclosed',   0.69,  1200,  'Copper',    '60x6.35',  22,  55,  'IP54'),
      ($4, 'Eaton Pow-R-Way III 2500',  'Enclosed',   0.69,  2500,  'Copper',    '76x9.5',   42,  105, 'IP54'),
      ($4, 'Eaton Pow-R-Way III 4000',  'Enclosed',   0.69,  4000,  'Copper',    '102x9.5x2',65,  158, 'IP54'),
      ($4, 'Eaton MV Bus',              'Metal-Clad',  15,   2500,  'Copper',    '80x10',    40,  100, 'IP4X')
    `, [m['ABB'], m['Siemens'], m['Schneider Electric'], m['Eaton']]);
    console.log('  Busbars seeded');

    await client.query('COMMIT');
    console.log('\n══════════════════════════════════════');
    console.log('All component libraries seeded successfully!');
    console.log('══════════════════════════════════════');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
