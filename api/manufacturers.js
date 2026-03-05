const { getDb } = require('../db/connection');

module.exports = async function handler(req, res) {
  const sql = getDb();
  try {
    const rows = await sql`SELECT * FROM manufacturers ORDER BY name`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
