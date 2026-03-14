"""
SynergyHub Database — PostgreSQL Layer (Python)
Mirrors the Node.js db.js: pool, init, genId, seed.
"""

import time
import random
import string
import psycopg
from psycopg.rows import dict_row
from .config import settings

_conn = None


def get_conn():
    """Get or create database connection."""
    global _conn
    if _conn is None or _conn.closed:
        dsn = settings.database_url
        _conn = psycopg.connect(dsn, autocommit=True, row_factory=dict_row)
    return _conn


def query(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a query and return rows as list of dicts."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        if cur.description:
            rows = cur.fetchall()
            return [_serialize_row(dict(r)) for r in rows]
        return []


def execute(sql: str, params: tuple = ()) -> None:
    """Execute a statement without returning rows."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)


def _serialize_row(row: dict) -> dict:
    """Convert PostgreSQL types to JSON-safe Python types."""
    import json
    from datetime import date, datetime
    from decimal import Decimal

    for key, val in row.items():
        if isinstance(val, datetime):
            row[key] = val.isoformat()
        elif isinstance(val, date):
            row[key] = val.isoformat()
        elif isinstance(val, Decimal):
            row[key] = float(val)
        # JSONB columns come back as Python lists/dicts already via psycopg2
    return row


def gen_id(prefix: str = "") -> str:
    """Generate ID matching existing format: prefix + base36 timestamp + random chars."""
    ts = int(time.time() * 1000)
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    ts_b36 = ""
    while ts > 0:
        ts_b36 = chars[ts % 36] + ts_b36
        ts //= 36
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{prefix}{ts_b36}{rand}"


def init():
    """Initialize database schema and seed data."""
    execute("""
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
        CREATE TABLE IF NOT EXISTS shift_listeners (
            id              TEXT PRIMARY KEY,
            shift_id        TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
            listener_name   TEXT NOT NULL,
            listener_email  TEXT NOT NULL,
            listener_phone  TEXT NOT NULL DEFAULT '',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
        CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
        CREATE INDEX IF NOT EXISTS idx_shift_listeners_shift ON shift_listeners(shift_id);
    """)

    # Migration: add tab column if missing
    execute("""
        DO $$ BEGIN
            ALTER TABLE tasks ADD COLUMN tab TEXT NOT NULL DEFAULT 'csm';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    execute("CREATE INDEX IF NOT EXISTS idx_tasks_tab ON tasks(tab)")

    # Migration: add checklist JSONB column
    execute("""
        DO $$ BEGIN
            ALTER TABLE tasks ADD COLUMN checklist JSONB NOT NULL DEFAULT '[]';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    # Migration: add email and phone to team_members
    execute("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN email TEXT NOT NULL DEFAULT '';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    execute("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN phone TEXT NOT NULL DEFAULT '';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    # Seed team members
    execute("""
        INSERT INTO team_members (id, name, role, avatar_color, is_active, email, phone) VALUES
            ('morten',  'Morten Skov',              'lead',    '#38456D', true, 'morten@peoplesdoctor.com', ''),
            ('shubi',   'Shubinthan Kathiramalai',   'support', '#5669A4', true, 'ska@peoplesdoctor.com',    '50732313'),
            ('simon',   'Simon Ussing',              'cs',      '#22C55E', true, 'sus@peoplesdoctor.com',    '00336 33234997'),
            ('emma',    'Emma Heerfordt',            'member',  '#F59E0B', true, 'ehe@peoplesdoctor.com',    '24494742'),
            ('filip',   'Filip Syderbø',             'member',  '#3B82F6', true, 'fsy@peoplesdoctor.com',    '52637516'),
            ('josef',   'Josef Abuna',               'member',  '#8B5CF6', true, 'jab@peoplesdoctor.com',    '52242880'),
            ('rasmus',  'Rasmus Kvist Bonde',        'member',  '#EC4899', true, 'rkb@peoplesdoctor.com',    ''),
            ('lars',    'Lars Kensmark',             'member',  '#14B8A6', true, 'lke@peoplesdoctor.com',    '31170644')
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            avatar_color = EXCLUDED.avatar_color
    """)

    print("Database initialized")
