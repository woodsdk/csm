/* ═══════════════════════════════════════════
   Shift Routes — Vagtplan for med-studerende
   2-hour shifts: 08-10, 10-12, 12-14, 14-16
   ═══════════════════════════════════════════ */

const { pool, genId } = require('../db');

const SHIFT_SLOTS = [
  { start_time: '08:00', end_time: '10:00' },
  { start_time: '10:00', end_time: '12:00' },
  { start_time: '12:00', end_time: '14:00' },
  { start_time: '14:00', end_time: '16:00' }
];

// ── List shifts for a date range ──

async function list(query = {}) {
  let sql = "SELECT * FROM shifts WHERE status != 'cancelled'";
  const params = [];
  let idx = 1;

  if (query.date) {
    sql += ` AND date = $${idx++}`;
    params.push(query.date);
  }
  if (query.from && query.to) {
    sql += ` AND date >= $${idx++} AND date <= $${idx++}`;
    params.push(query.from, query.to);
  }

  sql += ' ORDER BY date ASC, start_time ASC';
  const { rows } = await pool.query(sql, params);
  return rows;
}

// ── Get available shift slots for a date ──

async function getAvailable(date) {
  const { rows: existing } = await pool.query(
    "SELECT start_time FROM shifts WHERE date = $1 AND status != 'cancelled'",
    [date]
  );
  const taken = existing.map(s => s.start_time);

  return SHIFT_SLOTS.filter(slot => !taken.includes(slot.start_time));
}

// ── Calendar view: shift coverage for next 30 days ──

async function getCalendar() {
  const today = new Date();
  const dates = [];

  for (let i = 0; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // Only weekdays
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      dates.push(dateStr);
    }
  }

  // Fetch all shifts in range
  const { rows: shifts } = await pool.query(
    "SELECT date, start_time, end_time, staff_name FROM shifts WHERE date >= $1 AND date <= $2 AND status != 'cancelled' ORDER BY start_time",
    [dates[0], dates[dates.length - 1]]
  );

  // Group by date
  return dates.map(date => ({
    date,
    shifts: shifts.filter(s => s.date === date),
    total_slots: SHIFT_SLOTS.length,
    filled_slots: shifts.filter(s => s.date === date).length
  }));
}

// ── Book a shift (med student signs up) ──

async function create(data) {
  const id = genId('sh_');

  // Validate slot exists
  const validSlot = SHIFT_SLOTS.find(s => s.start_time === data.start_time);
  if (!validSlot) {
    throw new Error('Ugyldigt vagtinterval');
  }

  // Check not already taken
  const { rows: existing } = await pool.query(
    "SELECT id FROM shifts WHERE date = $1 AND start_time = $2 AND status != 'cancelled'",
    [data.date, data.start_time]
  );
  if (existing.length > 0) {
    throw new Error('Denne vagt er allerede taget');
  }

  const { rows } = await pool.query(`
    INSERT INTO shifts (id, date, start_time, end_time, staff_name, staff_email, staff_phone, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
    RETURNING *
  `, [
    id,
    data.date,
    data.start_time,
    validSlot.end_time,
    data.staff_name,
    data.staff_email,
    data.staff_phone || '',
  ]);

  return rows[0];
}

// ── Cancel a shift ──

async function cancel(id) {
  const { rows } = await pool.query(
    "UPDATE shifts SET status = 'cancelled' WHERE id = $1 RETURNING *",
    [id]
  );
  return rows[0] || null;
}

module.exports = { list, getAvailable, getCalendar, create, cancel, SHIFT_SLOTS };
