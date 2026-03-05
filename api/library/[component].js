const { getDb } = require('../../db/connection');

const LIBRARY_TABLES = {
  transformers:           'lib_transformers',
  cables:                 'lib_cables',
  lines:                  'lib_lines',
  generators:             'lib_generators',
  motors:                 'lib_motors',
  'circuit-breakers':     'lib_circuit_breakers',
  disconnectors:          'lib_disconnectors',
  fuses:                  'lib_fuses',
  'current-transformers': 'lib_current_transformers',
  'voltage-transformers': 'lib_voltage_transformers',
  'protection-relays':    'lib_protection_relays',
  busbars:                'lib_busbars',
};

module.exports = async function handler(req, res) {
  const { component } = req.query;
  const table = LIBRARY_TABLES[component];
  if (!table) return res.status(404).json({ error: 'Unknown component type' });

  const sql = getDb();
  const manufacturer = req.query.manufacturer;

  try {
    let rows;
    if (manufacturer) {
      rows = await sql`
        SELECT t.*, m.name as manufacturer_name
        FROM ${sql(table)} t
        JOIN manufacturers m ON t.manufacturer_id = m.id
        WHERE m.id = ${manufacturer}
        ORDER BY t.model
      `;
    } else {
      rows = await sql`
        SELECT t.*, m.name as manufacturer_name
        FROM ${sql(table)} t
        JOIN manufacturers m ON t.manufacturer_id = m.id
        ORDER BY m.name, t.model
      `;
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
