-- Tables owned by Arcus Legal. They reference platform tables by id (org_id, contact_id) with foreign
-- keys, but the platform schema never references them. Same row-level security as platform tables.

CREATE TABLE legal_matters
(
    id              uuid PRIMARY KEY     DEFAULT gen_random_uuid(),
    org_id          uuid        NOT NULL REFERENCES organizations ON DELETE CASCADE,
    contact_id      uuid        NOT NULL REFERENCES contacts ON DELETE CASCADE,
    title           text        NOT NULL,
    case_number     text,
    cnr             text,
    court           text,
    case_type       text,
    opposite_party  text,
    stage           text,
    status          text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    next_hearing_on date,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX legal_matters_org_next_idx ON legal_matters (org_id, next_hearing_on);
CREATE INDEX legal_matters_org_contact_idx ON legal_matters (org_id, contact_id);
SELECT arcus_enable_tenant_rls('legal_matters');
