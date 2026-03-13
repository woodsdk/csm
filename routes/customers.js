/* ═══════════════════════════════════════════
   Customer Routes — CRUD
   ═══════════════════════════════════════════ */

const { pool, genId } = require('../db');

async function list() {
  const { rows } = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
  return rows;
}

async function get(id) {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(data) {
  const id = genId('cust_');
  const { rows } = await pool.query(`
    INSERT INTO customers (id, name, segment, lifecycle, contact_name, contact_email, plan, licenses_total, licenses_used, mrr, dpa_signed, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    id,
    data.name || '',
    data.segment || 'direct',
    data.lifecycle || 'lead',
    data.contact_name || '',
    data.contact_email || '',
    data.plan || 'freemium',
    data.licenses_total || 0,
    data.licenses_used || 0,
    data.mrr || 0,
    data.dpa_signed || false,
    data.notes || ''
  ]);
  return rows[0];
}

async function update(id, data) {
  const current = await get(id);
  if (!current) return null;

  const fields = [];
  const params = [];
  let idx = 1;

  const allowed = ['name', 'segment', 'lifecycle', 'contact_name', 'contact_email', 'plan', 'licenses_total', 'licenses_used', 'mrr', 'dpa_signed', 'dpa_signed_at', 'onboarding_started_at', 'go_live_at', 'notes'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(data[key]);
    }
  }

  if (fields.length === 0) return current;

  params.push(id);
  const sql = `UPDATE customers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

module.exports = { list, get, create, update };
