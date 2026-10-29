-- Arcus platform schema.
--
-- Tenant isolation is enforced by Postgres row-level security (RLS): every table that belongs to an
-- organization has an org_id column and a policy that only shows/accepts rows of the organization set
-- for the current transaction (SET LOCAL arcus.org_id). The platform sets it automatically at the start of
-- every transaction (see TenantTransactionManager). With no organization set, tenant tables are empty and
-- unwritable, so a forgotten filter fails closed. Platform code that must work across organizations
-- (login, public links) runs in an explicit "system" scope (arcus.bypass = on).
--
-- RLS does not apply to superusers or roles with BYPASSRLS, so the application must connect as an ordinary
-- role (the server refuses to start otherwise). FORCE makes the policies apply to the table owner too.
--
-- App-owned tables live in each app's own migrations (db/apps/<app>) and follow the same rules.

CREATE FUNCTION arcus_rls_allows(row_org uuid) RETURNS boolean
    LANGUAGE sql STABLE AS
$$
SELECT coalesce(current_setting('arcus.bypass', true), '') = 'on'
    OR row_org::text = coalesce(current_setting('arcus.org_id', true), '')
$$;

-- Enables RLS with the standard tenant policy on a table that has an org_id column.
CREATE FUNCTION arcus_enable_tenant_rls(tbl regclass) RETURNS void
    LANGUAGE plpgsql AS
$$
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %s USING (arcus_rls_allows(org_id)) WITH CHECK (arcus_rls_allows(org_id))', tbl);
END
$$;

CREATE TABLE organizations
(
    id         uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    slug       text        NOT NULL UNIQUE,
    app        text        NOT NULL,                 -- the app this organization runs, e.g. 'clinic'
    modules    text[]      NOT NULL DEFAULT '{}',   -- platform modules switched on, e.g. {queue,appointments}
    city       text,
    phone      text,
    email      text,
    address    text,
    locale     text        NOT NULL DEFAULT 'en',
    settings   jsonb       NOT NULL DEFAULT '{}',   -- app/module settings (fees, queue estimates, GSTIN...)
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations USING (arcus_rls_allows(id)) WITH CHECK (arcus_rls_allows(id));

CREATE TABLE users
(
    id            uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    email         text        NOT NULL UNIQUE,
    name          text        NOT NULL,
    phone         text,
    password_hash text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships
(
    id              uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id          uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
    role            text        NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'PRACTITIONER', 'STAFF')),
    title           text,
    qualifications  text,
    registration_no text,
    active          boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);
SELECT arcus_enable_tenant_rls('memberships');

CREATE TABLE sessions
(
    id         text PRIMARY KEY,                    -- sha256 of the bearer token
    user_id    uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
    org_id     uuid REFERENCES organizations ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE contacts
(
    id              uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id          uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    name            text        NOT NULL,
    phone           text        NOT NULL,           -- E.164; not unique: families share numbers
    email           text,
    gender          text CHECK (gender IN ('M', 'F', 'O')),
    dob             date,
    address         text,
    preferred_lang  text        NOT NULL DEFAULT 'en',
    whatsapp_opt_in boolean     NOT NULL DEFAULT true,
    consent_at      timestamptz,                    -- DPDP consent timestamp
    tags            text[]      NOT NULL DEFAULT '{}',
    fields          jsonb       NOT NULL DEFAULT '{}', -- app-defined fields (allergies, occupation...)
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_org_phone_idx ON contacts (org_id, phone);
CREATE INDEX contacts_org_name_idx ON contacts (org_id, lower(name));
SELECT arcus_enable_tenant_rls('contacts');

CREATE TABLE appointments
(
    id           uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id       uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    contact_id   uuid        NOT NULL REFERENCES contacts ON DELETE CASCADE,
    provider_id  uuid REFERENCES memberships,
    starts_at    timestamptz NOT NULL,
    duration_min int         NOT NULL DEFAULT 15,
    status       text        NOT NULL DEFAULT 'BOOKED'
        CHECK (status IN ('BOOKED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    source       text        NOT NULL DEFAULT 'PHONE',
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_org_starts_idx ON appointments (org_id, starts_at);
SELECT arcus_enable_tenant_rls('appointments');

CREATE TABLE queue_entries
(
    id             uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id         uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    date           date        NOT NULL,            -- IST calendar day
    token_number   int         NOT NULL,
    contact_id     uuid        NOT NULL REFERENCES contacts ON DELETE CASCADE,
    provider_id    uuid REFERENCES memberships,
    appointment_id uuid UNIQUE REFERENCES appointments,
    status         text        NOT NULL DEFAULT 'WAITING'
        CHECK (status IN ('WAITING', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'CANCELLED')),
    public_code    text        NOT NULL UNIQUE,     -- unguessable code for the public status page
    checked_in_at  timestamptz NOT NULL DEFAULT now(),
    started_at     timestamptz,
    completed_at   timestamptz,
    UNIQUE (org_id, date, token_number)
);
CREATE INDEX queue_entries_org_date_status_idx ON queue_entries (org_id, date, status);
SELECT arcus_enable_tenant_rls('queue_entries');

CREATE TABLE encounters
(
    id             uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id         uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    contact_id     uuid        NOT NULL REFERENCES contacts ON DELETE CASCADE,
    provider_id    uuid REFERENCES memberships,
    queue_entry_id uuid UNIQUE REFERENCES queue_entries,
    ref_type       text,                            -- link to an app record, e.g. ('matter', <id>)
    ref_id         text,
    kind           text        NOT NULL,            -- e.g. CONSULTATION, HEARING
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    summary        text,
    data           jsonb       NOT NULL DEFAULT '{}',
    follow_up_on   date,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encounters_org_occurred_idx ON encounters (org_id, occurred_at);
CREATE INDEX encounters_org_ref_idx ON encounters (org_id, ref_type, ref_id);
CREATE INDEX encounters_contact_idx ON encounters (contact_id);
SELECT arcus_enable_tenant_rls('encounters');

CREATE TABLE documents
(
    id           uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id       uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    contact_id   uuid        NOT NULL REFERENCES contacts ON DELETE CASCADE,
    encounter_id uuid REFERENCES encounters,
    ref_type     text,
    ref_id       text,
    type         text        NOT NULL,              -- e.g. PRESCRIPTION; apps render their own types
    title        text        NOT NULL,
    data         jsonb       NOT NULL DEFAULT '{}',
    public_code  text        NOT NULL UNIQUE,
    created_by   uuid,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_org_created_idx ON documents (org_id, created_at);
SELECT arcus_enable_tenant_rls('documents');

CREATE TABLE catalog_items
(
    id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid    NOT NULL REFERENCES organizations ON DELETE CASCADE,
    kind   text    NOT NULL,                        -- SERVICE, or app-defined (e.g. MEDICINE)
    name   text    NOT NULL,
    price  bigint  NOT NULL DEFAULT 0,              -- paise
    data   jsonb   NOT NULL DEFAULT '{}',
    active boolean NOT NULL DEFAULT true
);
CREATE INDEX catalog_items_org_kind_idx ON catalog_items (org_id, kind);
SELECT arcus_enable_tenant_rls('catalog_items');

CREATE TABLE invoices
(
    id           uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id       uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    number       int         NOT NULL,
    contact_id   uuid        NOT NULL REFERENCES contacts ON DELETE CASCADE,
    encounter_id uuid REFERENCES encounters,
    ref_type     text,
    ref_id       text,
    status       text        NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'VOID')),
    subtotal     bigint      NOT NULL,              -- all money in paise
    discount     bigint      NOT NULL DEFAULT 0,
    total        bigint      NOT NULL,
    paid         bigint      NOT NULL DEFAULT 0,
    notes        text,
    void_reason  text,
    public_code  text        NOT NULL UNIQUE,
    created_by   uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, number)
);
CREATE INDEX invoices_org_created_idx ON invoices (org_id, created_at);
CREATE INDEX invoices_org_ref_idx ON invoices (org_id, ref_type, ref_id);
SELECT arcus_enable_tenant_rls('invoices');

CREATE TABLE invoice_items
(
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      uuid   NOT NULL REFERENCES organizations ON DELETE CASCADE,
    invoice_id  uuid   NOT NULL REFERENCES invoices ON DELETE CASCADE,
    description text   NOT NULL,
    qty         int    NOT NULL DEFAULT 1,
    unit_price  bigint NOT NULL,
    amount      bigint NOT NULL
);
CREATE INDEX invoice_items_invoice_idx ON invoice_items (invoice_id);
SELECT arcus_enable_tenant_rls('invoice_items');

CREATE TABLE payments
(
    id          uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id      uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    invoice_id  uuid        NOT NULL REFERENCES invoices ON DELETE CASCADE,
    amount      bigint      NOT NULL,
    mode        text        NOT NULL CHECK (mode IN ('CASH', 'UPI', 'CARD', 'BANK', 'OTHER')),
    reference   text,
    received_by uuid,
    received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_org_received_idx ON payments (org_id, received_at);
SELECT arcus_enable_tenant_rls('payments');

CREATE TABLE tasks
(
    id          uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id      uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    contact_id  uuid REFERENCES contacts ON DELETE CASCADE,
    ref_type    text,
    ref_id      text,
    kind        text        NOT NULL DEFAULT 'GENERAL',
    title       text        NOT NULL,
    due_on      date        NOT NULL,
    status      text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
    reminded_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_org_status_due_idx ON tasks (org_id, status, due_on);
CREATE INDEX tasks_org_ref_idx ON tasks (org_id, ref_type, ref_id);
SELECT arcus_enable_tenant_rls('tasks');

CREATE TABLE messages
(
    id           uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id       uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    contact_id   uuid REFERENCES contacts ON DELETE SET NULL,
    channel      text        NOT NULL DEFAULT 'WHATSAPP',
    to_phone     text        NOT NULL,
    template     text        NOT NULL,
    body         text        NOT NULL,
    status       text        NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
    provider     text        NOT NULL,
    provider_ref text,
    error        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_org_created_idx ON messages (org_id, created_at);
SELECT arcus_enable_tenant_rls('messages');

CREATE TABLE audit_logs
(
    id         uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id     uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    actor_id   uuid,
    actor_name text,
    action     text        NOT NULL,
    entity     text        NOT NULL,
    entity_id  text,
    data       jsonb       NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_org_created_idx ON audit_logs (org_id, created_at);
SELECT arcus_enable_tenant_rls('audit_logs');

CREATE TABLE counters
(
    org_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
    key    text NOT NULL,
    value  int  NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, key)
);
SELECT arcus_enable_tenant_rls('counters');
