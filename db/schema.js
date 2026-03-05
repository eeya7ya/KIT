const { pool } = require('./connection');

async function createSchema() {
  const client = await pool.connect();
  console.log('Creating database schema...');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS component_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS manufacturers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        country VARCHAR(50),
        website VARCHAR(200)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_transformers (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(10) NOT NULL DEFAULT '2W',
        rated_power_mva NUMERIC(10,2) NOT NULL,
        primary_voltage_kv NUMERIC(10,2) NOT NULL,
        secondary_voltage_kv NUMERIC(10,2) NOT NULL,
        tertiary_voltage_kv NUMERIC(10,2),
        impedance_pct NUMERIC(6,3) NOT NULL,
        no_load_loss_kw NUMERIC(10,2),
        load_loss_kw NUMERIC(10,2),
        no_load_current_pct NUMERIC(6,3),
        tap_range_pct VARCHAR(20),
        vector_group VARCHAR(20),
        cooling_type VARCHAR(20),
        frequency_hz INT DEFAULT 50,
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_cables (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        voltage_rating_kv NUMERIC(10,2) NOT NULL,
        conductor_size_mm2 NUMERIC(10,2) NOT NULL,
        conductor_material VARCHAR(5) NOT NULL DEFAULT 'Cu',
        cores INT DEFAULT 3,
        resistance_ohm_per_km NUMERIC(10,6) NOT NULL,
        reactance_ohm_per_km NUMERIC(10,6) NOT NULL,
        capacitance_uf_per_km NUMERIC(10,6),
        ampacity_a NUMERIC(10,2) NOT NULL,
        insulation_type VARCHAR(20),
        short_circuit_rating_ka NUMERIC(10,2),
        outer_diameter_mm NUMERIC(10,2),
        weight_kg_per_km NUMERIC(10,2),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_lines (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        conductor_type VARCHAR(20) NOT NULL,
        voltage_rating_kv NUMERIC(10,2) NOT NULL,
        cross_section_mm2 NUMERIC(10,2) NOT NULL,
        resistance_ohm_per_km NUMERIC(10,6) NOT NULL,
        reactance_ohm_per_km NUMERIC(10,6) NOT NULL,
        susceptance_us_per_km NUMERIC(10,6),
        ampacity_a NUMERIC(10,2) NOT NULL,
        sil_mw NUMERIC(10,2),
        diameter_mm NUMERIC(10,2),
        weight_kg_per_km NUMERIC(10,2),
        breaking_load_kn NUMERIC(10,2),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_generators (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'Synchronous',
        rated_power_mva NUMERIC(10,2) NOT NULL,
        rated_voltage_kv NUMERIC(10,2) NOT NULL,
        power_factor NUMERIC(5,3) DEFAULT 0.85,
        frequency_hz INT DEFAULT 50,
        speed_rpm INT,
        poles INT,
        xd_sync_pu NUMERIC(6,4),
        xd_trans_pu NUMERIC(6,4),
        xd_subtrans_pu NUMERIC(6,4),
        x0_pu NUMERIC(6,4),
        x2_pu NUMERIC(6,4),
        inertia_constant_h NUMERIC(6,3),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_motors (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'Induction',
        rated_power_kw NUMERIC(10,2) NOT NULL,
        rated_voltage_kv NUMERIC(10,3) NOT NULL,
        full_load_current_a NUMERIC(10,2),
        efficiency_pct NUMERIC(5,2),
        power_factor NUMERIC(5,3),
        locked_rotor_current_pu NUMERIC(5,2),
        starting_torque_pct NUMERIC(6,2),
        speed_rpm INT,
        poles INT,
        frame_size VARCHAR(20),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_circuit_breakers (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL,
        rated_voltage_kv NUMERIC(10,2) NOT NULL,
        rated_current_a NUMERIC(10,2) NOT NULL,
        breaking_capacity_ka NUMERIC(10,2) NOT NULL,
        making_capacity_ka NUMERIC(10,2),
        operating_mechanism VARCHAR(30),
        short_time_withstand_ka NUMERIC(10,2),
        closing_time_ms NUMERIC(10,2),
        opening_time_ms NUMERIC(10,2),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_disconnectors (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL,
        rated_voltage_kv NUMERIC(10,2) NOT NULL,
        rated_current_a NUMERIC(10,2) NOT NULL,
        short_time_withstand_ka NUMERIC(10,2),
        peak_withstand_ka NUMERIC(10,2),
        insulation_level_kv NUMERIC(10,2),
        operating_mechanism VARCHAR(30),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_fuses (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL,
        rated_voltage_kv NUMERIC(10,2) NOT NULL,
        rated_current_a NUMERIC(10,2) NOT NULL,
        breaking_capacity_ka NUMERIC(10,2) NOT NULL,
        i2t_min NUMERIC(15,2),
        i2t_max NUMERIC(15,2),
        fuse_class VARCHAR(20),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_current_transformers (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL,
        rated_voltage_kv NUMERIC(10,2) NOT NULL,
        primary_current_a NUMERIC(10,2) NOT NULL,
        secondary_current_a NUMERIC(5,2) DEFAULT 5,
        accuracy_class VARCHAR(20) NOT NULL,
        burden_va NUMERIC(10,2) NOT NULL,
        alf NUMERIC(5,1),
        thermal_rating_ka_1s NUMERIC(10,2),
        dynamic_rating_ka NUMERIC(10,2),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_voltage_transformers (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL,
        rated_primary_voltage_kv NUMERIC(10,3) NOT NULL,
        rated_secondary_voltage_v NUMERIC(10,2) DEFAULT 110,
        accuracy_class VARCHAR(20) NOT NULL,
        burden_va NUMERIC(10,2) NOT NULL,
        voltage_factor VARCHAR(20),
        thermal_limit_va NUMERIC(10,2),
        insulation_level_kv NUMERIC(10,2),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_protection_relays (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        function_code VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        ct_inputs INT DEFAULT 0,
        vt_inputs INT DEFAULT 0,
        binary_inputs INT,
        binary_outputs INT,
        communication VARCHAR(100),
        pickup_range VARCHAR(50),
        time_dial_range VARCHAR(50),
        curve_types VARCHAR(200),
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lib_busbars (
        id SERIAL PRIMARY KEY,
        manufacturer_id INT REFERENCES manufacturers(id),
        model VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL,
        rated_voltage_kv NUMERIC(10,2) NOT NULL,
        rated_current_a NUMERIC(10,2) NOT NULL,
        material VARCHAR(20) NOT NULL DEFAULT 'Copper',
        dimensions_mm VARCHAR(50),
        short_time_withstand_ka NUMERIC(10,2),
        peak_withstand_ka NUMERIC(10,2),
        ip_rating VARCHAR(10),
        notes TEXT
      )
    `);

    console.log('Schema created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

createSchema().catch(err => {
  console.error('Schema creation failed:', err);
  process.exit(1);
});
