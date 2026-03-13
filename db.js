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
      is_archived       BOOLEAN NOT NULL DEFAULT false
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

  await seedIfEmpty();
  console.log('Database initialized');
}

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM tasks');
  if (rows[0].count > 0) return;

  console.log('Seeding database...');

  // Team members
  await pool.query(`
    INSERT INTO team_members (id, name, role, avatar_color, is_active) VALUES
      ('morten', 'Morten', 'lead', '#38456D', true),
      ('shubi', 'Shubi', 'support', '#5669A4', true),
      ('simon', 'Simon', 'cs', '#22C55E', true)
    ON CONFLICT (id) DO NOTHING
  `);

  // Customers
  await pool.query(`
    INSERT INTO customers (id, name, segment, lifecycle, contact_name, contact_email, plan, licenses_total, licenses_used, mrr, dpa_signed, dpa_signed_at, onboarding_started_at, go_live_at, last_active_at, consultations_this_month, health_score, created_at, notes) VALUES
      ('cust_1', 'Klinik Vesterbro', 'plo', 'onboarding', 'Dr. Hansen', 'hansen@klinikvb.dk', 'premium', 8, 5, 3992, true, '2026-03-01', '2026-03-05', NULL, NULL, NULL, NULL, '2026-03-01T00:00:00Z', '6-læge praksis i Valby. Interesseret i klinikdrift-dashboard.'),
      ('cust_2', 'Sundhedshuset Amager', 'vores-klinik', 'active', 'Dr. Pedersen', 'info@sundhedshusetamager.dk', 'freemium', 4, 4, 0, true, '2026-02-15', '2026-02-15', '2026-02-20', '2026-03-12', 87, 82, '2026-02-10T00:00:00Z', 'Freemium bruger. Potentiel upsell til premium.'),
      ('cust_3', 'Lægehuset Nørrebro', 'cgm-xmo', 'trial', 'Dr. Jensen', 'jensen@laegehuset-n.dk', 'premium', 12, 3, 0, false, NULL, NULL, NULL, '2026-03-11', 12, 45, '2026-03-08T00:00:00Z', '12-læge praksis. CGM XMO integration. Trial startet 8/3.'),
      ('cust_4', 'Rosengård Lægepraksis', 'plo', 'lead', 'Dr. Nielsen', 'nielsen@rosengaard.dk', 'freemium', 0, 0, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-10T00:00:00Z', 'Kontaktet via PLO netværk. Afventer demo.')
    ON CONFLICT (id) DO NOTHING
  `);

  // Tasks
  await pool.query(`
    INSERT INTO tasks (id, title, description, status, priority, type, tags, assignee_id, created_by, deadline, created_at, updated_at, completed_at, customer_id, customer_name, sort_order, is_archived) VALUES
      ('t_seed1', 'Onboard Klinik Vesterbro — DPA + demo', 'DPA underskrevet 1/3. Demo booket torsdag kl. 14:00. Forbered credentials og klinik-setup i admin.', 'in-progress', 'high', 'onboarding', '["plo","pilot"]', 'simon', 'morten', '2026-03-20', '2026-03-05T09:00:00Z', '2026-03-12T14:00:00Z', NULL, 'cust_1', 'Klinik Vesterbro', 0, false),
      ('t_seed2', 'Fix login-fejl for Sundhedshuset Amager', 'Bruger rapporterer 403-fejl ved login. Tjek RBAC og session-token.', 'todo', 'critical', 'bug', '["urgent"]', 'shubi', 'shubi', '2026-03-14', '2026-03-13T08:00:00Z', '2026-03-13T08:00:00Z', NULL, 'cust_2', 'Sundhedshuset Amager', 1, false),
      ('t_seed3', 'Forbered Q1 kunderapport', 'Aggregér usage data, satisfaction scores og churn metrics for Q1. Klar til board-meeting.', 'review', 'medium', 'internal', '["rapport","q1"]', 'morten', 'morten', '2026-03-31', '2026-03-10T10:00:00Z', '2026-03-12T16:00:00Z', NULL, NULL, '', 2, false),
      ('t_seed4', 'Følg op på Lægehuset Nørrebro trial', 'Kun 3 af 12 licenser aktiveret. Ring og hør hvordan det går med CGM XMO integrationen.', 'todo', 'medium', 'cs-followup', '["cgm-xmo","adoption"]', 'simon', 'simon', '2026-03-18', '2026-03-11T11:00:00Z', '2026-03-11T11:00:00Z', NULL, 'cust_3', 'Lægehuset Nørrebro', 3, false),
      ('t_seed5', 'PLO pilot-evaluering — 50 brugere', 'Forbered evalueringsrapport for PLO pilot. 70% kvalitet / 30% pris scoring. Deadline for submission.', 'todo', 'high', 'onboarding', '["plo","tender","pilot"]', 'morten', 'morten', '2026-03-25', '2026-03-08T09:00:00Z', '2026-03-08T09:00:00Z', NULL, NULL, '', 4, false),
      ('t_seed6', 'Opdater onboarding-guide til CGM XMO', 'Tilføj screenshots af nye CGM XMO integration steps. Opdater FAQ-sektion.', 'done', 'low', 'internal', '["docs","cgm-xmo"]', 'shubi', 'morten', '2026-03-12', '2026-03-06T10:00:00Z', '2026-03-12T15:00:00Z', '2026-03-12T15:00:00Z', NULL, '', 5, false)
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('Seed data inserted');
}

module.exports = { pool, init, genId };
