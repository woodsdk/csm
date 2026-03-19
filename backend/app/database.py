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


def _safe_exec(sql: str, params: tuple = (), label: str = "") -> bool:
    """Execute SQL, catching and logging errors without crashing init."""
    try:
        execute(sql, params)
        return True
    except Exception as e:
        print(f"DB init warning ({label}): {e}")
        return False


def init():
    """Initialize database schema and seed data."""
    execute("""
        CREATE TABLE IF NOT EXISTS team_members (
            id             TEXT PRIMARY KEY,
            name           TEXT NOT NULL,
            role           TEXT NOT NULL DEFAULT 'member',
            title          TEXT NOT NULL DEFAULT '',
            avatar_color   TEXT NOT NULL DEFAULT '#38456D',
            is_active      BOOLEAN NOT NULL DEFAULT true,
            email          TEXT NOT NULL DEFAULT '',
            phone          TEXT NOT NULL DEFAULT '',
            can_give_demos BOOLEAN NOT NULL DEFAULT false
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
            tab               TEXT NOT NULL DEFAULT 'csm',
            cancel_reason     TEXT
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

        CREATE TABLE IF NOT EXISTS demo_bookings (
            id              TEXT PRIMARY KEY,
            date            DATE NOT NULL,
            start_time      TEXT NOT NULL,
            end_time        TEXT NOT NULL,
            client_name     TEXT NOT NULL,
            client_email    TEXT NOT NULL,
            client_phone    TEXT NOT NULL DEFAULT '',
            client_clinic   TEXT NOT NULL DEFAULT '',
            staff_id        TEXT REFERENCES team_members(id) ON DELETE SET NULL,
            meet_link       TEXT NOT NULL DEFAULT '',
            status          TEXT NOT NULL DEFAULT 'confirmed',
            task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
            notes           TEXT NOT NULL DEFAULT '',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_demo_bookings_date ON demo_bookings(date);
        CREATE INDEX IF NOT EXISTS idx_demo_bookings_status ON demo_bookings(status);
    """)

    # Migration: add tab column if missing
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE tasks ADD COLUMN tab TEXT NOT NULL DEFAULT 'csm';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="tasks.tab")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_tasks_tab ON tasks(tab)", label="idx_tasks_tab")

    # Migration: add checklist JSONB column
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE tasks ADD COLUMN checklist JSONB NOT NULL DEFAULT '[]';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="tasks.checklist")

    # Migration: add cancel_reason for onboarding task safety
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE tasks ADD COLUMN cancel_reason TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="tasks.cancel_reason")

    # Migration: add email and phone to team_members
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN email TEXT NOT NULL DEFAULT '';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="team_members.email")
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN phone TEXT NOT NULL DEFAULT '';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="team_members.phone")

    # Migration: add can_give_demos to team_members
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN can_give_demos BOOLEAN NOT NULL DEFAULT false;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="team_members.can_give_demos")

    # Migration: add title (stillingsbetegnelse) to team_members
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN title TEXT NOT NULL DEFAULT '';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="team_members.title")

    # Migration: add photo_data (base64) to team_members
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE team_members ADD COLUMN photo_data TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="team_members.photo_data")

    # Migration: add calendar_event_id to demo_bookings
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE demo_bookings ADD COLUMN calendar_event_id TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="demo_bookings.calendar_event_id")

    # Migration: create demo_participants table
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS demo_participants (
            id              TEXT PRIMARY KEY,
            booking_id      TEXT NOT NULL REFERENCES demo_bookings(id) ON DELETE CASCADE,
            name            TEXT NOT NULL,
            email           TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT '',
            is_primary      BOOLEAN NOT NULL DEFAULT false,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_demo_participants_booking ON demo_participants(booking_id);
    """, label="demo_participants")

    # Migration: create training_items table
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS training_items (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """, label="training_items")

    # Seed training items (onboarding checklist)
    _safe_exec("""
        INSERT INTO training_items (id, title, description, sort_order) VALUES
            ('tr_01', 'Vagtplan (tab)',                         'Forst\u00e5else for, hvordan du udfylder og koordinerer vagtplanen (Shubi er team-lead)',                                     1),
            ('tr_02', 'Kontaktliste (tab)',                     'Udfyld dine kontaktoplysninger og orienter dig om \u00f8vrige kollegaer i teamet',                                            2),
            ('tr_03', 'FAQ (tab)',                              'Gennemg\u00e5, l\u00e6s, forst\u00e5 og memor\u00e9r svar, s\u00e5 du ved hvad du skal svare p\u00e5 diverse spm.',                                              3),
            ('tr_04', 'Onboarding struktur (tab)',              'Gennemg\u00e5 og forst\u00e5, hvordan man strukturerer en god onboarding-session',                                             4),
            ('tr_05', 'Introduktion til compliance',            'Grundl\u00e6ggende sikkerhedsprincipper i supportarbejdet',                                                                   5),
            ('tr_06', 'WhatsApp-grupper',                       'Invitation til relevante People''s Doctor grupper',                                                                          6),
            ('tr_07', 'Onboarding pr\u00e6sentation',                'F\u00e5 adgang til onboarding pr\u00e6sentation',                                                                                    7),
            ('tr_08', 'Adgang til databehandleraftale',         'F\u00e5 adgang til og l\u00e6s og forst\u00e5, hvad den indeholder p\u00e5 et overordnet plan',                                                  8),
            ('tr_09', 'Instruktion i hvordan DBA skal sendes',  'Nogle af vores kunder skal have tilsendt en DBA til underskrift. Du skal vide hvordan man g\u00f8r dette.',                    9),
            ('tr_10', 'Eskaleringsveje',                        'Hvem man kontakter om hvad \u2014 tydelig ansvarsfordeling',                                                                  10),
            ('tr_11', 'Gennemgang af materiale',                'Alle relevante dokumenter, guides og templates der bruges i dagligdagen',                                                    11),
            ('tr_12', 'Telefonh\u00e5ndtering',                      'Forst\u00e5else for telefonsystem (sp\u00f8rg evt. Simon Ussing)',                                                                     12),
            ('tr_13', 'Calendly',                               'Forst\u00e5else for integration mellem Calendly til vores support@-kalender (sp\u00f8rg Shubi)',                                        13),
            ('tr_14', 'Styring af skema',                       'Logge ind p\u00e5 support@ og se hvilke onboardings, du skal tage ansvar p\u00e5.',                                                      14),
            ('tr_15', 'Koordinering med team',                  'Koordinering med teamet eller Simon Ussing omkring onboardinger ved behov. Ingen m\u00e5 falde mellem to stole.',              15),
            ('tr_16', 'Introduktion til marketing',             'Overordnet forst\u00e5else af virksomhedens markedsf\u00f8ringsstrategi',                                                              16)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            sort_order = EXCLUDED.sort_order
    """, label="seed_training_items")

    # Migration: add staff_id FK to shifts for linking to team_members
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE shifts ADD COLUMN staff_id TEXT REFERENCES team_members(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="shifts.staff_id")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id)", label="idx_shifts_staff_id")

    # Backfill: match existing shifts to team_members by email
    _safe_exec("""
        UPDATE shifts s
        SET staff_id = tm.id
        FROM team_members tm
        WHERE s.staff_id IS NULL
          AND LOWER(s.staff_email) = LOWER(tm.email)
    """, label="backfill_shifts_staff_id")

    # Seed team members
    _safe_exec("""
        INSERT INTO team_members (id, name, role, title, avatar_color, is_active, email, phone, can_give_demos) VALUES
            ('morten',  'Morten Skov',              'lead',    'CEO & Co-Founder',           '#38456D', true, 'morten@peoplesdoctor.com', '',              true),
            ('shubi',   'Shubinthan Kathiramalai',   'support', 'Support Lead',               '#5669A4', true, 'ska@peoplesdoctor.com',    '50732313',      true),
            ('simon',   'Simon Ussing',              'cs',      'Customer Success Manager',   '#22C55E', true, 'sus@peoplesdoctor.com',    '00336 33234997', true),
            ('emma',    'Emma Heerfordt',            'member',  'Studentermedhjælper',        '#F59E0B', true, 'ehe@peoplesdoctor.com',    '24494742',      true),
            ('filip',   'Filip Syderbø',             'member',  'Studentermedhjælper',        '#3B82F6', true, 'fsy@peoplesdoctor.com',    '52637516',      true),
            ('josef',   'Josef Abuna',               'member',  'Studentermedhjælper',        '#8B5CF6', true, 'jab@peoplesdoctor.com',    '52242880',      true),
            ('rasmus',  'Rasmus Kvist Bonde',        'member',  'CTO & Co-Founder',           '#EC4899', true, 'rkb@peoplesdoctor.com',    '',              true),
            ('lars',    'Lars Kensmark',             'member',  'Studentermedhjælper',        '#14B8A6', true, 'lke@peoplesdoctor.com',    '31170644',      true)
        ON CONFLICT (id) DO NOTHING
    """, label="seed_team_members")

    # Migration: create faq_items table
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS faq_items (
            id          TEXT PRIMARY KEY,
            question    TEXT NOT NULL,
            answer      TEXT NOT NULL DEFAULT '',
            category    TEXT NOT NULL DEFAULT '',
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """, label="faq_items")

    # Migration: create tickets table
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS tickets (
            id               TEXT PRIMARY KEY,
            subject          TEXT NOT NULL,
            description      TEXT NOT NULL DEFAULT '',
            status           TEXT NOT NULL DEFAULT 'open',
            priority         TEXT NOT NULL DEFAULT 'medium',
            priority_source  TEXT NOT NULL DEFAULT 'manual',
            category         TEXT NOT NULL DEFAULT '',
            source           TEXT NOT NULL DEFAULT 'manual',
            requester_name   TEXT NOT NULL DEFAULT '',
            requester_email  TEXT NOT NULL DEFAULT '',
            assignee_id      TEXT REFERENCES team_members(id) ON DELETE SET NULL,
            platform_user_id TEXT,
            gmail_thread_id  TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            resolved_at      TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
        CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
    """, label="tickets")

    # Migration: add summary column to tickets
    _safe_exec("""
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT '';
    """, label="tickets_summary")

    # Migration: create ticket_messages table
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS ticket_messages (
            id               TEXT PRIMARY KEY,
            ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
            sender_type      TEXT NOT NULL DEFAULT 'agent',
            sender_name      TEXT NOT NULL DEFAULT '',
            sender_email     TEXT NOT NULL DEFAULT '',
            body             TEXT NOT NULL,
            is_internal      BOOLEAN NOT NULL DEFAULT false,
            gmail_message_id TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
    """, label="ticket_messages")

    # Migration: link tickets to platform users
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE tickets ADD COLUMN platform_user_id TEXT REFERENCES platform_users(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="tickets.platform_user_id")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_tickets_platform_user ON tickets(platform_user_id)", label="idx_tickets_platform_user")

    # Google OAuth tokens (single-row table for shared account)
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS google_oauth_tokens (
            id            TEXT PRIMARY KEY DEFAULT 'shared',
            account_email TEXT NOT NULL,
            access_token  TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            token_expiry  TIMESTAMPTZ NOT NULL,
            scopes        TEXT NOT NULL DEFAULT '',
            connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """, label="google_oauth_tokens")

    # Migration: Gmail thread/message IDs on tickets
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE tickets ADD COLUMN gmail_thread_id TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="tickets.gmail_thread_id")
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE ticket_messages ADD COLUMN gmail_message_id TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="ticket_messages.gmail_message_id")

    # Migration: AI priority classification tracking
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE tickets ADD COLUMN priority_source TEXT NOT NULL DEFAULT 'manual';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="tickets.priority_source")

    # Migration: add campaign_batch and send_error to marketing_emails_sent
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE marketing_emails_sent ADD COLUMN campaign_batch TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="marketing_emails_sent.campaign_batch")
    _safe_exec("""
        DO $$ BEGIN
            ALTER TABLE marketing_emails_sent ADD COLUMN send_error TEXT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """, label="marketing_emails_sent.send_error")

    # Seed FAQ items
    _safe_exec("""
        INSERT INTO faq_items (id, question, answer, category, sort_order) VALUES
            ('faq_01', 'Er I ISO 27001-certificerede?', 'Nej, men vi f\u00f8lger ISO 27001 som rammevaerk og overholder alle relevante krav i praksis. Vi har valgt ikke at certificere os endnu, da det er en stor investering for en virksomhed i vores stadie, men vi arbejder efter de samme principper. Vi er desuden ISAE 3000-revisionserklaeret, hvilket bekraefter vores sikkerhedspraksis uafhaengigt.', 'Sikkerhed & Compliance', 1),
            ('faq_02', 'Har I en databehandleraftale (DPA)?', 'Ja, vi har en fuld databehandleraftale klar til underskrift. Den opfylder GDPR-kravene og daekker alle aspekter af databehandlingen. Vi sender den til alle kunder som en del af onboarding-processen.', 'Sikkerhed & Compliance', 2),
            ('faq_03', 'Hvor hostes data?', 'Al data hostes i EU (specifikt i Tyskland og Irland via AWS). Vi bruger ingen servere uden for EU, og der sker ingen tredjelandsoverf\u00f8rsel af persondata.', 'Sikkerhed & Compliance', 3),
            ('faq_04', 'Hvem har adgang til patientdata?', 'Ingen hos People''s Doctor har direkte adgang til patientdata. Data er krypteret, og vi fungerer udelukkende som databehandler. Kun klinikkens egne brugere med de rette roller har adgang via systemet.', 'Sikkerhed & Compliance', 4),
            ('faq_05', 'Hvad g\u00f8r I ved sikkerhedsbrud?', 'Vi har en fuld incident response-plan. Ved et eventuelt brud notificerer vi den dataansvarlige (klinikken) inden for 24 timer, dokumenterer haendelsen og ivaerksaetter afhjaelpning. Det er dog aldrig sket.', 'Sikkerhed & Compliance', 5),
            ('faq_06', 'Hvad kan systemet?', 'People''s Doctor er en alt-i-en platform til klinikker. Det inkluderer online booking, patientjournal, kommunikation (SMS/email), fakturering, lagerstyring og rapportering \u2014 alt samlet et sted.', 'Produkt & Funktioner', 10),
            ('faq_07', 'Kan det integreres med andre systemer?', 'Ja. Vi har aabne API''er og integrerer med e-conomic, Dinero, og flere bookingplatforme. Vi bygger l\u00f8bende nye integrationer baseret paa kundebehov.', 'Produkt & Funktioner', 11),
            ('faq_08', 'Underst\u00f8tter I flersprogede klinikker?', 'Systemet er i dag paa dansk, men vi arbejder paa flersproget underst\u00f8ttelse. Patienter kan allerede nu modtage SMS og emails paa det sprog, klinikken vaelger.', 'Produkt & Funktioner', 12),
            ('faq_09', 'Hvordan haandterer I opdateringer?', 'Vi k\u00f8rer l\u00f8bende opdateringer (typisk ugentligt) uden nedetid. Alle kunder faar automatisk de nyeste funktioner. Vi varsler st\u00f8rre aendringer i forvejen via email.', 'Produkt & Funktioner', 13),
            ('faq_10', 'Er der en app?', 'Systemet er webbaseret og fungerer paa alle enheder (mobil, tablet, desktop) via browseren. Vi har ikke en dedikeret app endnu, men PWA-underst\u00f8ttelse er paa roadmap.', 'Produkt & Funktioner', 14),
            ('faq_11', 'Hvad koster det?', 'Vi har fleksible prismodeller baseret paa klinikkens st\u00f8rrelse og behov. Kontakt os for et specifikt tilbud \u2014 vi tilpasser altid til den enkelte klinik. Vores priser starter typisk fra 499 kr/md.', 'Pris & Praktisk', 20),
            ('faq_12', 'Er der en bindingsperiode?', 'Vi har ingen lang bindingsperiode. Standardaftalen er maaned-til-maaned med 3 maaneders opsigelse efter en eventuel minimumsperiode.', 'Pris & Praktisk', 21),
            ('faq_13', 'Hvor lang tid tager onboarding?', 'En typisk onboarding tager 2-4 uger afhaengig af klinikkens st\u00f8rrelse og kompleksitet. Vi har en dedikeret onboarding-specialist, der hjaelper hele vejen.', 'Pris & Praktisk', 22),
            ('faq_14', 'Kan vi migrere data fra vores nuvaerende system?', 'Ja, vi hjaelper med datamigrering fra de fleste eksisterende systemer. Vi haandterer hele processen, saa klinikken ikke mister vigtig historik.', 'Pris & Praktisk', 23),
            ('faq_15', 'Hvad hvis vi ikke er tilfredse?', 'Vi tilbyder en pr\u00f8veperiode, hvor I kan teste systemet. Hvis det ikke passer jer, kan I opsige uden omkostninger inden for pr\u00f8veperioden.', 'Typiske Bekymringer', 30),
            ('faq_16', 'Er det svaert at skifte system?', 'Vi g\u00f8r skiftet saa nemt som muligt. Vores onboarding-team haandterer datamigrering, opsaetning og traening. De fleste klinikker er fuldt operative inden for 2-3 uger.', 'Typiske Bekymringer', 31),
            ('faq_17', 'Hvad hvis systemet gaar ned?', 'Vi har 99.9%% uptime SLA. Vores infrastruktur er redundant og overvaaget 24/7. I tilfaelde af nedetid har vi automatisk failover og notificerer alle ber\u00f8rte kunder \u00f8jeblikkeligt.', 'Typiske Bekymringer', 32),
            ('faq_18', 'Kan vi faa support paa dansk?', 'Absolut. Al vores support er paa dansk, og vi har supporttider paa hverdage. Vi tilbyder support via email, telefon og chat.', 'Typiske Bekymringer', 33)
        ON CONFLICT (id) DO UPDATE SET
            question = EXCLUDED.question,
            answer = EXCLUDED.answer,
            category = EXCLUDED.category,
            sort_order = EXCLUDED.sort_order
    """, label="seed_faq")

    # ── Onboarding & Retention tables ──
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS platform_users (
            id                    TEXT PRIMARY KEY,
            name                  TEXT NOT NULL,
            email                 TEXT NOT NULL,
            phone                 TEXT DEFAULT '',
            clinic_name           TEXT NOT NULL,
            speciale              TEXT DEFAULT '',
            plan                  TEXT DEFAULT 'standard',
            mrr                   NUMERIC(10,2) DEFAULT 0,
            status                TEXT DEFAULT 'active',
            signup_at             TIMESTAMPTZ DEFAULT NOW(),
            first_consultation_at TIMESTAMPTZ,
            last_active_at        TIMESTAMPTZ,
            churned_at            TIMESTAMPTZ,
            churn_reason          TEXT,
            health_score          INTEGER DEFAULT 50,
            created_at            TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pu_status ON platform_users(status);
        CREATE INDEX IF NOT EXISTS idx_pu_signup ON platform_users(signup_at);

        CREATE TABLE IF NOT EXISTS platform_consultations (
            id                    TEXT PRIMARY KEY,
            user_id               TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
            consultation_date     DATE NOT NULL,
            duration_minutes      INTEGER DEFAULT 15,
            rating                NUMERIC(3,1),
            created_at            TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pc_user ON platform_consultations(user_id);
        CREATE INDEX IF NOT EXISTS idx_pc_date ON platform_consultations(consultation_date);

        CREATE TABLE IF NOT EXISTS platform_reviews (
            id                    TEXT PRIMARY KEY,
            user_id               TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
            rating                NUMERIC(3,1) NOT NULL,
            comment               TEXT DEFAULT '',
            sentiment             TEXT DEFAULT 'neutral',
            created_at            TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pr_user ON platform_reviews(user_id);
        CREATE INDEX IF NOT EXISTS idx_pr_created ON platform_reviews(created_at);

        CREATE TABLE IF NOT EXISTS platform_events (
            id                    TEXT PRIMARY KEY,
            user_id               TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
            event_type            TEXT NOT NULL,
            created_at            TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pe_user ON platform_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_pe_type ON platform_events(event_type);
    """, label="platform_tables")

    # ── Marketing Automation tables ──
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS marketing_segments (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            description     TEXT NOT NULL DEFAULT '',
            filter_rules    JSONB NOT NULL DEFAULT '{}',
            user_count      INTEGER NOT NULL DEFAULT 0,
            is_preset       BOOLEAN NOT NULL DEFAULT false,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS marketing_flows (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            description     TEXT NOT NULL DEFAULT '',
            trigger_type    TEXT NOT NULL DEFAULT 'manual',
            trigger_config  JSONB NOT NULL DEFAULT '{}',
            segment_id      TEXT REFERENCES marketing_segments(id) ON DELETE SET NULL,
            status          TEXT NOT NULL DEFAULT 'draft',
            is_template     BOOLEAN NOT NULL DEFAULT false,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mf_status ON marketing_flows(status);
        CREATE INDEX IF NOT EXISTS idx_mf_trigger ON marketing_flows(trigger_type);

        CREATE TABLE IF NOT EXISTS marketing_flow_steps (
            id              TEXT PRIMARY KEY,
            flow_id         TEXT NOT NULL REFERENCES marketing_flows(id) ON DELETE CASCADE,
            step_order      INTEGER NOT NULL DEFAULT 0,
            step_type       TEXT NOT NULL DEFAULT 'email',
            config          JSONB NOT NULL DEFAULT '{}',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mfs_flow ON marketing_flow_steps(flow_id);

        CREATE TABLE IF NOT EXISTS marketing_enrollments (
            id              TEXT PRIMARY KEY,
            flow_id         TEXT NOT NULL REFERENCES marketing_flows(id) ON DELETE CASCADE,
            user_id         TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
            current_step    INTEGER NOT NULL DEFAULT 0,
            status          TEXT NOT NULL DEFAULT 'active',
            enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            next_action_at  TIMESTAMPTZ,
            completed_at    TIMESTAMPTZ,
            UNIQUE(flow_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_me_flow ON marketing_enrollments(flow_id);
        CREATE INDEX IF NOT EXISTS idx_me_user ON marketing_enrollments(user_id);
        CREATE INDEX IF NOT EXISTS idx_me_next ON marketing_enrollments(next_action_at);
        CREATE INDEX IF NOT EXISTS idx_me_status ON marketing_enrollments(status);

        CREATE TABLE IF NOT EXISTS marketing_emails_sent (
            id              TEXT PRIMARY KEY,
            enrollment_id   TEXT REFERENCES marketing_enrollments(id) ON DELETE SET NULL,
            flow_id         TEXT REFERENCES marketing_flows(id) ON DELETE SET NULL,
            step_id         TEXT REFERENCES marketing_flow_steps(id) ON DELETE SET NULL,
            user_id         TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
            to_email        TEXT NOT NULL,
            subject         TEXT NOT NULL,
            body_html       TEXT NOT NULL,
            brief           TEXT NOT NULL DEFAULT '',
            gmail_message_id TEXT,
            gmail_thread_id  TEXT,
            status          TEXT NOT NULL DEFAULT 'sent',
            campaign_batch  TEXT,
            send_error      TEXT,
            sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mes_user ON marketing_emails_sent(user_id);
        CREATE INDEX IF NOT EXISTS idx_mes_flow ON marketing_emails_sent(flow_id);
        CREATE INDEX IF NOT EXISTS idx_mes_sent ON marketing_emails_sent(sent_at);
    """, label="marketing_tables")

    # App settings (key-value store for system-wide config)
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );
    """, label="app_settings")

    # DPA Documents — versionered DPA PDFs
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS dpa_documents (
            id          TEXT PRIMARY KEY,
            version     INTEGER NOT NULL DEFAULT 1,
            language    TEXT NOT NULL DEFAULT 'da',
            filename    TEXT NOT NULL DEFAULT '',
            pdf_data    BYTEA,
            uploaded_by TEXT NOT NULL DEFAULT '',
            is_current  BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(version, language)
        );
    """, label="dpa_documents")

    # DPA Signings — audit trail for DPA signatures
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS dpa_signings (
            id              TEXT PRIMARY KEY,
            customer_id     TEXT,
            document_id     TEXT REFERENCES dpa_documents(id),
            token           TEXT NOT NULL UNIQUE,
            language        TEXT NOT NULL DEFAULT 'da',
            status          TEXT NOT NULL DEFAULT 'pending',
            signer_name     TEXT NOT NULL DEFAULT '',
            signer_email    TEXT NOT NULL DEFAULT '',
            signer_title    TEXT NOT NULL DEFAULT '',
            ip_address      TEXT NOT NULL DEFAULT '',
            user_agent      TEXT NOT NULL DEFAULT '',
            sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            signed_at       TIMESTAMPTZ,
            expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
            sent_by         TEXT NOT NULL DEFAULT '',
            reminder_count  INTEGER NOT NULL DEFAULT 0,
            last_reminder_at TIMESTAMPTZ,
            cs_notified     BOOLEAN NOT NULL DEFAULT false,
            recipient_name  TEXT NOT NULL DEFAULT '',
            recipient_email TEXT NOT NULL DEFAULT '',
            recipient_company TEXT NOT NULL DEFAULT ''
        );
    """, label="dpa_signings")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_dpa_signings_token ON dpa_signings(token)", label="idx_dpa_signings_token")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_dpa_signings_customer ON dpa_signings(customer_id)", label="idx_dpa_signings_customer")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_dpa_signings_status ON dpa_signings(status)", label="idx_dpa_signings_status")

    # Migrations: add recipient fields + make customer_id nullable
    _safe_exec("ALTER TABLE dpa_signings ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT ''", label="dpa_signings_recipient_name")
    _safe_exec("ALTER TABLE dpa_signings ADD COLUMN IF NOT EXISTS recipient_email TEXT NOT NULL DEFAULT ''", label="dpa_signings_recipient_email")
    _safe_exec("ALTER TABLE dpa_signings ADD COLUMN IF NOT EXISTS recipient_company TEXT NOT NULL DEFAULT ''", label="dpa_signings_recipient_company")
    _safe_exec("ALTER TABLE dpa_signings ALTER COLUMN customer_id DROP NOT NULL", label="dpa_signings_customer_id_nullable")
    _safe_exec("ALTER TABLE dpa_signings ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false", label="dpa_signings_is_archived")

    # Dismissed signals: track which CS signals have been dismissed
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS dismissed_signals (
            id              TEXT PRIMARY KEY,
            signal_type     TEXT NOT NULL,
            user_id         TEXT NOT NULL,
            dismissed_by    TEXT,
            dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(signal_type, user_id)
        );
    """, label="dismissed_signals")

    # Platform announcements
    _safe_exec("""
        CREATE TABLE IF NOT EXISTS announcements (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            body            TEXT NOT NULL DEFAULT '',
            type            TEXT NOT NULL DEFAULT 'modal',
            audience_type   TEXT NOT NULL DEFAULT 'all',
            segment_id      TEXT REFERENCES marketing_segments(id) ON DELETE SET NULL,
            status          TEXT NOT NULL DEFAULT 'draft',
            publish_at      TIMESTAMPTZ,
            expires_at      TIMESTAMPTZ,
            created_by      TEXT NOT NULL DEFAULT '',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            published_at    TIMESTAMPTZ
        );
    """, label="announcements")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)", label="idx_announcements_status")

    _safe_exec("""
        CREATE TABLE IF NOT EXISTS announcement_deliveries (
            id                TEXT PRIMARY KEY,
            announcement_id   TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
            user_id           TEXT NOT NULL,
            delivered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            read_at           TIMESTAMPTZ,
            UNIQUE(announcement_id, user_id)
        );
    """, label="announcement_deliveries")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_ad_announcement ON announcement_deliveries(announcement_id)", label="idx_ad_announcement")
    _safe_exec("CREATE INDEX IF NOT EXISTS idx_ad_user ON announcement_deliveries(user_id)", label="idx_ad_user")

    # Seed default marketing AI system prompt
    _safe_exec("""
        INSERT INTO app_settings (key, value) VALUES (
            'marketing_ai_prompt',
            'Du er en professionel email-forfatter for People''s Clinic, en dansk digital sundhedsplatform der bruger AI til at opsummere læge-patient samtaler.

REGLER:
- Skriv ALTID på dansk
- Vær varm, professionel og empatisk — aldrig sælgende eller pushy
- Personaliser baseret på brugerens data (navn, klinik, speciale, aktivitet)
- Hold emailen kort (3-5 afsnit, max 150 ord)
- Giv ALDRIG medicinsk rådgivning eller diagnosticering
- Nævn aldrig patientdata eller specifik patientinformation
- Henvis til platformen for konkret sundhedsrådgivning
- Start med "Hej [fornavn],"
- Afslut med "Med venlig hilsen,\nPeople''s Clinic Teamet"
- SVAR KUN med et JSON-objekt: {"subject": "...", "body_html": "..."}
- body_html: brug simple HTML tags (<p>, <br>, <strong>) — INGEN inline styles
- Subject: max 60 tegn, relevant og engagerende'
        ) ON CONFLICT (key) DO NOTHING
    """, label="seed_marketing_prompt")

    try:
        _seed_platform_data()
    except Exception as e:
        print(f"DB init warning (seed_platform_data): {e}")
    try:
        _seed_marketing_templates()
    except Exception as e:
        print(f"DB init warning (seed_marketing_templates): {e}")

    print("Database initialized")


def _seed_platform_data():
    """Seed 50 fictitious platform users with consultations, reviews & events."""
    import random
    from datetime import datetime, timedelta

    # Check if already seeded
    existing = query("SELECT COUNT(*) as cnt FROM platform_users")
    if existing and existing[0]["cnt"] > 0:
        return

    random.seed(42)  # Reproducible
    now = datetime.now()

    clinics = [
        ("Sundhedshuset Nørrebro", "Almen praksis"),
        ("Klinik Vanløse", "Almen praksis"),
        ("Frederiksberg Lægecenter", "Almen praksis"),
        ("Lægerne i Hellerup", "Almen praksis"),
        ("Praksis Østerbro", "Almen praksis"),
        ("SundKlinik Amager", "Fysioterapi"),
        ("Ballerup Sundhedscenter", "Fysioterapi"),
        ("Roskilde Lægecenter", "Almen praksis"),
        ("Greve Lægecenter", "Almen praksis"),
        ("Ringsted Klinik", "Kiropraktik"),
        ("Sundhedsklinikken Aarhus", "Almen praksis"),
        ("Holbæk Sundhedshus", "Hudlæge"),
        ("Taastrup Praksis", "Almen praksis"),
        ("Glostrup Lægepraksis", "Ørelæge"),
        ("Slagelse Praksis", "Fysioterapi"),
        ("Klinik i Brønshøj", "Almen praksis"),
        ("Regionsklinikken Hillerød", "Almen praksis"),
        ("Køge Lægepraksis", "Almen praksis"),
    ]

    first_names = [
        "Oliver", "Emma", "Mathilde", "Jonas", "Astrid", "Nanna", "Thomas",
        "Louise", "Rasmus", "Sara", "Victor", "Freja", "Line", "Nikolaj",
        "Katrine", "Alexander", "Anne", "Henrik", "Birgitte", "Erik",
        "Camilla", "Mads", "Sofie", "Christian", "Ida", "Peter", "Laura",
        "Jens", "Maria", "Mikkel", "Cecilie", "Anders", "Lærke", "Frederik",
        "Nanna", "Søren", "Hanne", "Kasper", "Julie", "Oscar", "Clara",
        "Magnus", "Amalie", "Simon", "Thea", "Daniel", "Maja", "Lars",
        "Anna", "Morten",
    ]

    last_names = [
        "Jensen", "Nielsen", "Hansen", "Andersen", "Pedersen", "Christensen",
        "Larsen", "Sørensen", "Rasmussen", "Poulsen", "Johansen", "Madsen",
        "Kristensen", "Olsen", "Thomsen", "Jørgensen", "Mortensen", "Gram",
        "Frost", "Hjort", "Dahl", "Bech", "Friis",
    ]

    danish_comments_positive = [
        "Rigtig godt system, nemt at bruge.",
        "Fungerer perfekt med min USB-mikrofon.",
        "Imponeret over hastigheden.",
        "Sparer markant tid i hverdagen.",
        "Super nemt at komme i gang.",
        "God præcision på medicinsk terminologi.",
        "Rigtig godt. Kunne ønske bedre dialekthåndtering.",
        "Vores personale er begejstrede.",
        "Fantastisk support fra teamet.",
    ]
    danish_comments_neutral = [
        "God præcision på medicinsk terminologi.",
        "For komplekst at sætte op.",
        "Transskription stopper midt i samtalen.",
        "Transskriptionen misforstod medicinske termer.",
        "Lydkvalitet/mikrofon ikke optimal.",
        "Journalen fanger ikke alle detaljer.",
        "Mangler bedre FMK-integration.",
        "Savner skabeloner til journaler.",
    ]
    danish_comments_negative = [
        "For komplekst at sætte op.",
        "Transskription stopper midt i samtalen.",
        "Lydkvaliteten var dårlig via Bluetooth.",
        "Mikrofon bliver ikke genkendt korrekt.",
    ]

    churn_reasons = ["technical", "price", "complexity", "competitor", "no_need"]
    churn_reason_labels = {
        "technical": "Tekniske problemer (lyd/mikrofon)",
        "price": "For dyrt / manglende værdi",
        "complexity": "For komplekst / manglende tid",
        "competitor": "Skiftet til konkurrent",
        "no_need": "Ukendt / ingen feedback",
    }

    users = []
    user_ids = []

    # Generate 50 users in segments
    # Segment 1: 20 active healthy users (signup 30-180 days ago)
    for i in range(20):
        uid = f"pu_{i+1:03d}"
        user_ids.append(uid)
        days_ago = random.randint(30, 180)
        signup = now - timedelta(days=days_ago)
        first_consult = signup + timedelta(days=random.randint(1, 7))
        last_active = now - timedelta(days=random.randint(0, 5))
        clinic = random.choice(clinics)
        name = f"{first_names[i]} {random.choice(last_names)}"
        email = f"{first_names[i].lower()}.{random.choice(last_names).lower()}@{random.choice(['mail.dk','praksis.dk','sundhed.dk','regionh.dk','klinik.dk','laeger.dk'])}"
        health = random.randint(65, 100)
        mrr = random.choice([499, 499, 799, 799, 1299, 1299, 1999])
        plan = "standard" if mrr < 1000 else "premium" if mrr > 1500 else "professional"

        users.append((uid, name, email, "", clinic[0], clinic[1], plan, mrr, "active",
                       signup.isoformat(), first_consult.isoformat(), last_active.isoformat(),
                       None, None, health))

    # Segment 2: 10 new users (signup 1-14 days ago)
    for i in range(20, 30):
        uid = f"pu_{i+1:03d}"
        user_ids.append(uid)
        days_ago = random.randint(0, 14)
        signup = now - timedelta(days=days_ago)
        first_consult = (signup + timedelta(days=random.randint(1, 3))) if days_ago > 3 and random.random() > 0.4 else None
        last_active = now - timedelta(days=random.randint(0, 2)) if first_consult else signup
        clinic = random.choice(clinics)
        name = f"{first_names[i]} {random.choice(last_names)}"
        email = f"{first_names[i].lower()}.{random.choice(last_names).lower()}@{random.choice(['mail.dk','praksis.dk','sundhed.dk','regionh.dk','klinik.dk','laeger.dk'])}"
        health = random.randint(40, 70)
        mrr = random.choice([499, 499, 799])

        users.append((uid, name, email, "", clinic[0], clinic[1], "standard", mrr, "onboarding",
                       signup.isoformat(),
                       first_consult.isoformat() if first_consult else None,
                       last_active.isoformat(),
                       None, None, health))

    # Segment 3: 10 inactive / at-risk (signup 30-90 days ago, last active 14-45 days ago)
    for i in range(30, 40):
        uid = f"pu_{i+1:03d}"
        user_ids.append(uid)
        days_ago = random.randint(30, 90)
        signup = now - timedelta(days=days_ago)
        first_consult = signup + timedelta(days=random.randint(2, 10))
        last_active = now - timedelta(days=random.randint(14, 45))
        clinic = random.choice(clinics)
        name = f"{first_names[i]} {random.choice(last_names)}"
        email = f"{first_names[i].lower()}.{random.choice(last_names).lower()}@{random.choice(['mail.dk','praksis.dk','sundhed.dk','regionh.dk','klinik.dk','laeger.dk'])}"
        health = random.randint(15, 40)
        mrr = random.choice([499, 499, 799, 799])

        users.append((uid, name, email, "", clinic[0], clinic[1], "standard", mrr, "inactive",
                       signup.isoformat(), first_consult.isoformat(), last_active.isoformat(),
                       None, None, health))

    # Segment 4: 7 churned (signup 60-180 days ago)
    for i in range(40, 47):
        uid = f"pu_{i+1:03d}"
        user_ids.append(uid)
        days_ago = random.randint(60, 180)
        signup = now - timedelta(days=days_ago)
        churn_after = random.randint(7, 60)
        churned_at = signup + timedelta(days=churn_after)
        first_consult = signup + timedelta(days=random.randint(1, 5)) if random.random() > 0.3 else None
        last_active = churned_at - timedelta(days=random.randint(1, 7))
        clinic = random.choice(clinics)
        name = f"{first_names[i]} {random.choice(last_names)}"
        email = f"{first_names[i].lower()}.{random.choice(last_names).lower()}@{random.choice(['mail.dk','praksis.dk','sundhed.dk','regionh.dk','klinik.dk','laeger.dk'])}"
        reason = random.choice(churn_reasons)

        users.append((uid, name, email, "", clinic[0], clinic[1], "standard", 0, "churned",
                       signup.isoformat(),
                       first_consult.isoformat() if first_consult else None,
                       last_active.isoformat(),
                       churned_at.isoformat(), reason, 0))

    # Segment 5: 3 stuck in onboarding (signup 7-21 days ago, no consultations)
    for i in range(47, 50):
        uid = f"pu_{i+1:03d}"
        user_ids.append(uid)
        days_ago = random.randint(7, 21)
        signup = now - timedelta(days=days_ago)
        clinic = random.choice(clinics)
        name = f"{first_names[i]} {random.choice(last_names)}"
        email = f"{first_names[i].lower()}.{random.choice(last_names).lower()}@{random.choice(['mail.dk','praksis.dk','klinik.dk'])}"
        health = random.randint(10, 30)

        users.append((uid, name, email, "", clinic[0], clinic[1], "standard", 499, "onboarding",
                       signup.isoformat(), None, signup.isoformat(),
                       None, None, health))

    # Insert users
    for u in users:
        execute(
            """INSERT INTO platform_users (id, name, email, phone, clinic_name, speciale, plan, mrr, status,
               signup_at, first_consultation_at, last_active_at, churned_at, churn_reason, health_score)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (id) DO NOTHING""",
            u,
        )

    # Generate consultations
    consult_id = 1
    for u in users:
        uid, name, email, _, _, _, _, _, status, signup_str = u[:10]
        first_consult_str = u[10]
        if not first_consult_str or status == "churned":
            # Churned users: 0-3 consultations
            if status == "churned" and first_consult_str:
                n = random.randint(0, 3)
                fc = datetime.fromisoformat(first_consult_str)
                for j in range(n):
                    cdate = fc + timedelta(days=j * random.randint(2, 7))
                    rating = round(random.uniform(3.0, 8.0), 1)
                    execute(
                        """INSERT INTO platform_consultations (id, user_id, consultation_date, duration_minutes, rating)
                           VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                        (f"pc_{consult_id:04d}", uid, cdate.strftime("%Y-%m-%d"), random.randint(10, 30), rating),
                    )
                    consult_id += 1
            continue
        if status == "onboarding":
            # New users: 0-2 consultations
            n = random.randint(0, 2)
        else:
            # Active users: 3-15 consultations
            n = random.randint(3, 15)
        fc = datetime.fromisoformat(first_consult_str)
        for j in range(n):
            cdate = fc + timedelta(days=j * random.randint(3, 14))
            if cdate > now:
                break
            rating = round(random.uniform(5.0, 10.0), 1)
            execute(
                """INSERT INTO platform_consultations (id, user_id, consultation_date, duration_minutes, rating)
                   VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                (f"pc_{consult_id:04d}", uid, cdate.strftime("%Y-%m-%d"), random.randint(10, 30), rating),
            )
            consult_id += 1

    # Generate reviews (from active + onboarding users)
    review_id = 1
    for u in users:
        uid, name, email, _, _, _, _, _, status, signup_str = u[:10]
        if status in ("churned",):
            # Some churned users leave bad reviews
            if random.random() > 0.5:
                rating = round(random.uniform(2.0, 5.0), 1)
                comment = random.choice(danish_comments_negative)
                sentiment = "kritisk"
                days_offset = random.randint(10, 40)
                review_date = datetime.fromisoformat(signup_str) + timedelta(days=days_offset)
                execute(
                    """INSERT INTO platform_reviews (id, user_id, rating, comment, sentiment, created_at)
                       VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                    (f"pr_{review_id:04d}", uid, rating, comment, sentiment, review_date.isoformat()),
                )
                review_id += 1
            continue
        if status == "inactive":
            if random.random() > 0.6:
                rating = round(random.uniform(4.0, 7.0), 1)
                comment = random.choice(danish_comments_neutral)
                sentiment = "neutral"
                days_offset = random.randint(14, 40)
                review_date = datetime.fromisoformat(signup_str) + timedelta(days=days_offset)
                execute(
                    """INSERT INTO platform_reviews (id, user_id, rating, comment, sentiment, created_at)
                       VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                    (f"pr_{review_id:04d}", uid, rating, comment, sentiment, review_date.isoformat()),
                )
                review_id += 1
            continue
        # Active users: 1-3 reviews
        n_reviews = random.randint(1, 3) if status == "active" else random.randint(0, 1)
        for j in range(n_reviews):
            rating = round(random.uniform(6.0, 10.0), 1)
            if rating >= 8.0:
                comment = random.choice(danish_comments_positive)
                sentiment = "positiv"
            else:
                comment = random.choice(danish_comments_neutral)
                sentiment = "neutral"
            days_offset = random.randint(7, 60)
            review_date = datetime.fromisoformat(signup_str) + timedelta(days=days_offset)
            if review_date > now:
                review_date = now - timedelta(days=random.randint(1, 14))
            execute(
                """INSERT INTO platform_reviews (id, user_id, rating, comment, sentiment, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                (f"pr_{review_id:04d}", uid, rating, comment, sentiment, review_date.isoformat()),
            )
            review_id += 1

    # Generate onboarding funnel events
    event_id = 1
    funnel_stages = ["signup", "mitid_verified", "email_verified", "speciale_set", "clinic_created", "first_consultation", "second_consultation"]
    for u in users:
        uid, name, _, _, _, _, _, _, status, signup_str = u[:10]
        first_consult_str = u[10]
        signup = datetime.fromisoformat(signup_str)

        # Everyone has signup
        execute(
            """INSERT INTO platform_events (id, user_id, event_type, created_at)
               VALUES (%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
            (f"pe_{event_id:05d}", uid, "signup", signup.isoformat()),
        )
        event_id += 1

        # Determine how far in funnel
        if status == "active":
            stages_reached = len(funnel_stages)  # All stages
        elif status == "churned":
            stages_reached = random.randint(2, 5)
        elif status == "inactive":
            stages_reached = random.randint(3, 6)
        elif status == "onboarding" and first_consult_str:
            stages_reached = random.randint(4, 6)
        else:
            stages_reached = random.randint(1, 3)  # Stuck

        ts = signup
        for si, stage in enumerate(funnel_stages[1:stages_reached], 1):
            ts = ts + timedelta(hours=random.randint(1, 48))
            execute(
                """INSERT INTO platform_events (id, user_id, event_type, created_at)
                   VALUES (%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                (f"pe_{event_id:05d}", uid, stage, ts.isoformat()),
            )
            event_id += 1


def _seed_marketing_templates():
    """Seed pre-built marketing flow templates and segments."""
    import json

    existing = query("SELECT COUNT(*) as cnt FROM marketing_flows WHERE is_template = true")
    if existing and existing[0]["cnt"] > 0:
        return

    # ── Pre-built segments ──
    segments = [
        ("ms_new_users", "Nye brugere (0-14 dage)", "Brugere der har tilmeldt sig inden for de sidste 14 dage",
         json.dumps({"status": ["onboarding", "active"], "signup_days_ago_max": 14}), True),
        ("ms_inactive_14", "Inaktive (14+ dage)", "Aktive brugere der ikke har vaeret aktive i 14+ dage",
         json.dumps({"status": ["active"], "days_inactive_min": 14}), True),
        ("ms_at_risk", "Risiko-brugere", "Brugere med health score under 30",
         json.dumps({"status": ["active", "inactive"], "health_score_max": 30}), True),
        ("ms_stuck", "Stuck onboarding", "Brugere der ikke har haft foerste konsultation efter 7+ dage",
         json.dumps({"status": ["onboarding"], "has_consultation": False, "signup_days_ago_min": 7}), True),
        ("ms_happy", "Tilfredse brugere", "Aktive brugere med health score over 70",
         json.dumps({"status": ["active"], "health_score_min": 70}), True),
    ]
    for sid, name, desc, rules, preset in segments:
        execute(
            """INSERT INTO marketing_segments (id, name, description, filter_rules, is_preset)
               VALUES (%s, %s, %s, %s::jsonb, %s) ON CONFLICT (id) DO NOTHING""",
            (sid, name, desc, rules, preset),
        )

    # ── Pre-built flow templates ──
    templates = [
        ("mf_tpl_welcome", "Velkomstflow", "Automatisk velkomst-sekvens for nye brugere", "signup"),
        ("mf_tpl_inactive", "Inaktive brugere", "Genaktiverings-flow for brugere der er faldet fra", "inactive_14d"),
        ("mf_tpl_feedback", "Negativ feedback opfoelgning", "Automatisk opfoelgning paa negativ feedback", "negative_feedback"),
        ("mf_tpl_stuck", "Stuck onboarding", "Nudge til brugere der ikke har booket foerste konsultation", "stuck_onboarding"),
        ("mf_tpl_health", "Health score drop", "Proaktiv outreach naar health score falder", "health_drop"),
    ]
    for fid, name, desc, trigger in templates:
        config = json.dumps({"threshold": 30}) if trigger == "health_drop" else "{}"
        execute(
            """INSERT INTO marketing_flows (id, name, description, trigger_type, trigger_config, status, is_template)
               VALUES (%s, %s, %s, %s, %s::jsonb, 'draft', true) ON CONFLICT (id) DO NOTHING""",
            (fid, name, desc, trigger, config),
        )

    # ── Template steps ──
    steps = [
        # Welcome flow
        ("mfs_w1", "mf_tpl_welcome", 0, "email", json.dumps({
            "brief": "Byd brugeren velkommen til People's Clinic. Forklar kort hvordan de kommer i gang med at booke deres foerste konsultation. Naevn at supporten er klar til at hjaelpe.",
            "subject_hint": "Velkommen til People's Clinic"
        })),
        ("mfs_w2", "mf_tpl_welcome", 1, "wait", json.dumps({"days": 3})),
        ("mfs_w3", "mf_tpl_welcome", 2, "email", json.dumps({
            "brief": "Venlig paamindelse om at booke den foerste konsultation. Tilbyd hjaelp med opsaetning af mikrofon og system. Vaer opmuntrende.",
            "subject_hint": "Klar til din foerste konsultation?"
        })),
        ("mfs_w4", "mf_tpl_welcome", 3, "wait", json.dumps({"days": 5})),
        ("mfs_w5", "mf_tpl_welcome", 4, "email", json.dumps({
            "brief": "Opfoelgning efter den foerste uge. Spoerg om alt fungerer og tilbyd en personlig 1-til-1 onboarding session.",
            "subject_hint": "Hvordan gaar det?"
        })),
        # Inactive flow
        ("mfs_i1", "mf_tpl_inactive", 0, "email", json.dumps({
            "brief": "Bemaerk at vi har set brugeren ikke har vaeret aktiv i en periode. Spoerg om alt er ok og om der er noget vi kan hjaelpe med. Vaer empatisk, ikke pushy.",
            "subject_hint": "Vi savner dig"
        })),
        ("mfs_i2", "mf_tpl_inactive", 1, "wait", json.dumps({"days": 7})),
        ("mfs_i3", "mf_tpl_inactive", 2, "email", json.dumps({
            "brief": "Fortael om nye features og forbedringer paa platformen. Inviter brugeren til at proeve systemet igen.",
            "subject_hint": "Nyt paa People's Clinic"
        })),
        # Negative feedback flow
        ("mfs_f1", "mf_tpl_feedback", 0, "email", json.dumps({
            "brief": "Tak brugeren for deres aerlige feedback. Anerkend den specifikke bekymring fra deres seneste review. Fortael hvad vi goer for at forbedre og tilbyd en personlig opfoelgning.",
            "subject_hint": "Tak for din feedback"
        })),
        # Stuck onboarding flow
        ("mfs_s1", "mf_tpl_stuck", 0, "email", json.dumps({
            "brief": "Bemaerk at brugeren har oprettet en konto men endnu ikke har haft deres foerste konsultation. Tilbyd hjaelp med opsaetning og forklar kort de naeste skridt.",
            "subject_hint": "Brug for hjaelp med at komme i gang?"
        })),
        ("mfs_s2", "mf_tpl_stuck", 1, "wait", json.dumps({"days": 4})),
        ("mfs_s3", "mf_tpl_stuck", 2, "email", json.dumps({
            "brief": "Sidste venlige paamindelse. Tilbyd en personlig onboarding-session via video. Forklar at det tager 15 minutter.",
            "subject_hint": "Personlig onboarding — vi hjaelper dig i gang"
        })),
        # Health drop flow
        ("mfs_h1", "mf_tpl_health", 0, "email", json.dumps({
            "brief": "Proaktiv henvendelse. Spoerg om brugeren oplever problemer med platformen. Tilbyd teknisk support og en check-in samtale med teamet.",
            "subject_hint": "Alt ok? Vi er her for dig"
        })),
    ]
    for sid, fid, order, stype, config in steps:
        execute(
            """INSERT INTO marketing_flow_steps (id, flow_id, step_order, step_type, config)
               VALUES (%s, %s, %s, %s, %s::jsonb) ON CONFLICT (id) DO NOTHING""",
            (sid, fid, order, stype, config),
        )
