/* ═══════════════════════════════════════════
   Task Routes — CRUD + filtering
   ═══════════════════════════════════════════ */

const { pool, genId } = require('../db');

async function list(query) {
  const conditions = ['is_archived = false'];
  const params = [];
  let idx = 1;

  if (query.status) {
    conditions.push(`status = $${idx++}`);
    params.push(query.status);
  }
  if (query.priority) {
    conditions.push(`priority = $${idx++}`);
    params.push(query.priority);
  }
  if (query.type) {
    conditions.push(`type = $${idx++}`);
    params.push(query.type);
  }
  if (query.assignee_id) {
    conditions.push(`assignee_id = $${idx++}`);
    params.push(query.assignee_id);
  }
  if (query.search) {
    const like = `%${query.search}%`;
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx} OR customer_name ILIKE $${idx} OR tags::text ILIKE $${idx})`);
    params.push(like);
    idx++;
  }

  const sql = `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, created_at DESC`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function get(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(data) {
  const id = genId('t_');
  const now = new Date().toISOString();

  const { rows: maxRows } = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tasks');
  const sortOrder = maxRows[0].next;

  const { rows } = await pool.query(`
    INSERT INTO tasks (id, title, description, status, priority, type, tags, assignee_id, created_by, deadline, created_at, updated_at, customer_id, customer_name, sort_order, is_archived)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, false)
    RETURNING *
  `, [
    id,
    data.title || '',
    data.description || '',
    data.status || 'todo',
    data.priority || 'medium',
    data.type || 'internal',
    JSON.stringify(data.tags || []),
    data.assignee_id || null,
    data.created_by || null,
    data.deadline || null,
    now,
    data.customer_id || null,
    data.customer_name || '',
    sortOrder
  ]);

  // Activity log
  await pool.query(
    'INSERT INTO activity_log (id, task_id, action, actor_id, created_at) VALUES ($1, $2, $3, $4, $5)',
    [genId('a_'), id, 'created', data.created_by || null, now]
  );

  return rows[0];
}

async function update(id, data) {
  // Get current task
  const current = await get(id);
  if (!current) return null;

  const fields = [];
  const params = [];
  let idx = 1;

  const allowed = ['title', 'description', 'status', 'priority', 'type', 'assignee_id', 'deadline', 'customer_id', 'customer_name', 'sort_order', 'is_archived', 'created_by', 'ticket_ref', 'calendar_event_id', 'parent_task_id'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(data[key]);
    }
  }

  // Handle tags separately (needs JSON stringify)
  if (data.tags !== undefined) {
    fields.push(`tags = $${idx++}`);
    params.push(JSON.stringify(data.tags));
  }

  // Always update updated_at
  fields.push(`updated_at = $${idx++}`);
  const now = new Date().toISOString();
  params.push(now);

  // Track completion
  if (data.status === 'done' && current.status !== 'done') {
    fields.push(`completed_at = $${idx++}`);
    params.push(now);
  } else if (data.status && data.status !== 'done') {
    fields.push(`completed_at = NULL`);
  }

  params.push(id);
  const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const { rows } = await pool.query(sql, params);

  // Activity logging
  if (data.status && data.status !== current.status) {
    await pool.query(
      'INSERT INTO activity_log (id, task_id, action, actor_id, old_value, new_value, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [genId('a_'), id, 'status_changed', null, current.status, data.status, now]
    );
  }
  if (data.assignee_id !== undefined && data.assignee_id !== current.assignee_id) {
    await pool.query(
      'INSERT INTO activity_log (id, task_id, action, actor_id, old_value, new_value, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [genId('a_'), id, 'assigned', null, current.assignee_id, data.assignee_id, now]
    );
  }

  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return { ok: true };
}

module.exports = { list, get, create, update, remove };
