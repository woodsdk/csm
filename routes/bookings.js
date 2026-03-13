/* ═══════════════════════════════════════════
   Booking Routes — 30-min onboarding sessions
   Availability driven by shifts (vagtplan)
   ═══════════════════════════════════════════ */

const { pool, genId } = require('../db');

const BOOKING_DURATION = 30; // minutes

// ── Available slots for a date (based on filled shifts) ──

async function getAvailable(date) {
  // Get confirmed shifts for this date
  const { rows: shifts } = await pool.query(
    "SELECT start_time, end_time FROM shifts WHERE date = $1 AND status = 'confirmed'",
    [date]
  );

  if (shifts.length === 0) return [];

  // Get existing bookings for this date
  const { rows: existingBookings } = await pool.query(
    "SELECT start_time, end_time FROM bookings WHERE date = $1 AND status != 'cancelled'",
    [date]
  );

  // Generate 30-min slots within each shift's time range
  const slots = [];

  for (const shift of shifts) {
    const shiftStart = timeToMin(shift.start_time);
    const shiftEnd = timeToMin(shift.end_time);

    for (let startMin = shiftStart; startMin + BOOKING_DURATION <= shiftEnd; startMin += 30) {
      const endMin = startMin + BOOKING_DURATION;
      const startTime = minToTime(startMin);
      const endTime = minToTime(endMin);

      // Check if slot is already booked
      const isBooked = existingBookings.some(b => {
        const bStart = timeToMin(b.start_time);
        const bEnd = timeToMin(b.end_time);
        return startMin < bEnd && endMin > bStart;
      });

      if (!isBooked) {
        slots.push({ start_time: startTime, end_time: endTime });
      }
    }
  }

  return slots;
}

// ── Available dates (next 30 days with at least 1 shift) ──

async function getAvailableDates() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() + 1);
  const to = new Date(today);
  to.setDate(to.getDate() + 30);

  const { rows } = await pool.query(
    "SELECT DISTINCT date FROM shifts WHERE date >= $1 AND date <= $2 AND status = 'confirmed' ORDER BY date",
    [from.toISOString().split('T')[0], to.toISOString().split('T')[0]]
  );

  // Filter to only dates that have available slots
  const dates = [];
  for (const row of rows) {
    const slots = await getAvailable(row.date);
    if (slots.length > 0) {
      dates.push(row.date);
    }
  }

  return dates;
}

// ── Create Booking (public) ──

async function create(data) {
  const id = genId('bk_');

  // Validate slot is available
  const slots = await getAvailable(data.date);
  const slot = slots.find(s => s.start_time === data.start_time);
  if (!slot) {
    throw new Error('Tidspunktet er ikke længere ledigt');
  }

  // Find which shift covers this slot
  const { rows: shiftRows } = await pool.query(
    "SELECT id, staff_name FROM shifts WHERE date = $1 AND status = 'confirmed' AND start_time <= $2 AND end_time >= $3",
    [data.date, data.start_time, slot.end_time]
  );
  const shift = shiftRows[0];

  // Auto-create task in SynergyHub
  const taskId = genId('t_');
  const taskTitle = `Onboarding: ${data.guest_name}${data.guest_company ? ' (' + data.guest_company + ')' : ''}`;
  const taskDesc = [
    `Booking: ${data.date} kl. ${data.start_time}-${slot.end_time}`,
    `Navn: ${data.guest_name}`,
    `Email: ${data.guest_email}`,
    data.guest_phone ? `Tlf: ${data.guest_phone}` : null,
    data.guest_company ? `Klinik: ${data.guest_company}` : null,
    shift ? `Vagt: ${shift.staff_name}` : null,
    data.notes ? `Note: ${data.notes}` : null
  ].filter(Boolean).join('\n');

  await pool.query(`
    INSERT INTO tasks (id, title, description, status, priority, type, tags, deadline, created_at, updated_at, sort_order, is_archived)
    VALUES ($1, $2, $3, 'todo', 'high', 'onboarding', '["booking"]', $4, NOW(), NOW(),
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks), false)
  `, [taskId, taskTitle, taskDesc, data.date]);

  // Create booking
  const { rows } = await pool.query(`
    INSERT INTO bookings (id, date, start_time, end_time, shift_id, guest_name, guest_email, guest_phone, guest_company, notes, status, task_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11)
    RETURNING *
  `, [
    id,
    data.date,
    data.start_time,
    slot.end_time,
    shift ? shift.id : null,
    data.guest_name,
    data.guest_email,
    data.guest_phone || '',
    data.guest_company || '',
    data.notes || '',
    taskId
  ]);

  return rows[0];
}

// ── List Bookings (internal) ──

async function list(query = {}) {
  let sql = "SELECT * FROM bookings WHERE 1=1";
  const params = [];
  let idx = 1;

  if (query.status) {
    sql += ` AND status = $${idx++}`;
    params.push(query.status);
  }
  if (query.date) {
    sql += ` AND date = $${idx++}`;
    params.push(query.date);
  }

  sql += ' ORDER BY date ASC, start_time ASC';
  const { rows } = await pool.query(sql, params);
  return rows;
}

// ── Update Booking ──

async function update(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;

  for (const key of ['status', 'notes']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      params.push(data[key]);
    }
  }

  if (fields.length === 0) return null;

  params.push(id);
  const sql = `UPDATE bookings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

// ── Helpers ──

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

module.exports = { getAvailable, getAvailableDates, create, list, update };
