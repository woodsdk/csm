/* ═══════════════════════════════════════════
   Team Routes — Read active members
   ═══════════════════════════════════════════ */

const { pool } = require('../db');

async function list() {
  const { rows } = await pool.query('SELECT * FROM team_members WHERE is_active = true ORDER BY name');
  return rows;
}

module.exports = { list };
