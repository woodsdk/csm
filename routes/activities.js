/* ═══════════════════════════════════════════
   Activity Routes — Task activity log
   ═══════════════════════════════════════════ */

const { pool } = require('../db');

async function listForTask(taskId) {
  const { rows } = await pool.query(
    'SELECT * FROM activity_log WHERE task_id = $1 ORDER BY created_at DESC LIMIT 50',
    [taskId]
  );
  return rows;
}

module.exports = { listForTask };
