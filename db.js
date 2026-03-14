/* ═══════════════════════════════════════════
   SynergyHub Database — PostgreSQL Layer
   ═══════════════════════════════════════════ */

try { require('dotenv').config(); } catch {}

const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Date objects
types.setTypeParser(1082, val => val); // 1082 = DATE OID

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RAILWAY_ENVIRONMENT
    ? { rejectUnauthorized: false }
    : false
});

function genId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'member',
      avatar_color TEXT NOT NULL DEFAULT '#38456D',
      is_active    BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS customers (
      id                       TEXT PRIMARY KEY,
      name                     TEXT NOT NULL,
      segment                  TEXT NOT NULL DEFAULT 'direct',
      lifecycle                TEXT NOT NULL DEFAULT 'lead',
      contact_name             TEXT NOT NULL DEFAULT '',
      contact_email            TEXT NOT NULL DEFAULT '',
      plan                     TEXT NOT NULL DEFAULT 'freemium',
      licenses_total           INTEGER NOT NULL DEFAULT 0,
      licenses_used            INTEGER NOT NULL DEFAULT 0,
      mrr                      NUMERIC(10,2) NOT NULL DEFAULT 0,
      dpa_signed               BOOLEAN NOT NULL DEFAULT false,
      dpa_signed_at            DATE,
      onboarding_started_at    DATE,
      go_live_at               DATE,
      last_active_at           TIMESTAMPTZ,
      consultations_this_month INTEGER,
      health_score             INTEGER,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes                    TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id                TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'todo',
      priority          TEXT NOT NULL DEFAULT 'medium',
      type              TEXT NOT NULL DEFAULT 'internal',
      tags              JSONB NOT NULL DEFAULT '[]',
      assignee_id       TEXT REFERENCES team_members(id) ON DELETE SET NULL,
      created_by        TEXT,
      deadline          DATE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at      TIMESTAMPTZ,
      customer_id       TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name     TEXT NOT NULL DEFAULT '',
      ticket_ref        TEXT,
      calendar_event_id TEXT,
      parent_task_id    TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      sort_order        INTEGER NOT NULL DEFAULT 0,
      is_archived       BOOLEAN NOT NULL DEFAULT false,
      tab               TEXT NOT NULL DEFAULT 'csm'
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      action     TEXT NOT NULL,
      actor_id   TEXT,
      old_value  TEXT,
      new_value  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id          TEXT PRIMARY KEY,
      date        DATE NOT NULL,
      start_time  TEXT NOT NULL,
      end_time    TEXT NOT NULL,
      staff_name  TEXT NOT NULL,
      staff_email TEXT NOT NULL,
      staff_phone TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'confirmed',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id              TEXT PRIMARY KEY,
      date            DATE NOT NULL,
      start_time      TEXT NOT NULL,
      end_time        TEXT NOT NULL,
      shift_id        TEXT REFERENCES shifts(id) ON DELETE SET NULL,
      guest_name      TEXT NOT NULL,
      guest_email     TEXT NOT NULL,
      guest_phone     TEXT NOT NULL DEFAULT '',
      guest_company   TEXT NOT NULL DEFAULT '',
      notes           TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'confirmed',
      task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
    CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_log(task_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
  `);

  // Migration: add tab column if missing (must run BEFORE tab index)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE tasks ADD COLUMN tab TEXT NOT NULL DEFAULT 'csm';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);

  // Tab index (after migration ensures column exists)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_tab ON tasks(tab)`);

  // Migration: add checklist JSONB column
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE tasks ADD COLUMN checklist JSONB NOT NULL DEFAULT '[]';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);

  // Clean up old seed data
  await pool.query(`DELETE FROM tasks WHERE id LIKE 't_seed%'`);
  await pool.query(`DELETE FROM customers WHERE id LIKE 'cust_%'`);

  // Seed team members (always needed)
  await pool.query(`
    INSERT INTO team_members (id, name, role, avatar_color, is_active) VALUES
      ('morten', 'Morten', 'lead', '#38456D', true),
      ('shubi', 'Shubi', 'support', '#5669A4', true),
      ('simon', 'Simon', 'cs', '#22C55E', true)
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('Database initialized');
}

module.exports = { pool, init, genId };
