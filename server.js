const express = require('express');
const cors = require('cors');
const { query } = require('./db/connection');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ── Library API Routes ──

// Get all manufacturers
app.get('/api/manufacturers', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM manufacturers ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Library table mapping
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

// Whitelist check to prevent SQL injection
function getTable(component) {
  return LIBRARY_TABLES[component] || null;
}

// GET /api/library — list all available component types
app.get('/api/library', (req, res) => {
  res.json({
    component_types: Object.keys(LIBRARY_TABLES),
    endpoints: Object.keys(LIBRARY_TABLES).map(k => `/api/library/${k}`)
  });
});

// GET /api/library/:component — list all items with manufacturer name
app.get('/api/library/:component', async (req, res) => {
  const table = getTable(req.params.component);
  if (!table) return res.status(404).json({ error: 'Unknown component type' });

  try {
    const rows = await query(`
      SELECT t.*, m.name as manufacturer_name
      FROM ${table} t
      JOIN manufacturers m ON t.manufacturer_id = m.id
      ORDER BY m.name, t.model
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/library/:component/manufacturer/:id — filter by manufacturer
app.get('/api/library/:component/manufacturer/:id', async (req, res) => {
  const table = getTable(req.params.component);
  if (!table) return res.status(404).json({ error: 'Unknown component type' });

  try {
    const rows = await query(`
      SELECT t.*, m.name as manufacturer_name
      FROM ${table} t
      JOIN manufacturers m ON t.manufacturer_id = m.id
      WHERE m.id = $1
      ORDER BY t.model
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/library/:component/:id — get single item
app.get('/api/library/:component/:id', async (req, res) => {
  const table = getTable(req.params.component);
  if (!table) return res.status(404).json({ error: 'Unknown component type' });

  try {
    const rows = await query(`
      SELECT t.*, m.name as manufacturer_name
      FROM ${table} t
      JOIN manufacturers m ON t.manufacturer_id = m.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM component_categories ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KIT Power System Server running on http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/library`);
});
