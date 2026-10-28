-- Separate the platform from domain apps.
--  * Organization.vertical (enum) -> Organization.app (text) + enabled modules
--  * CatalogItem.kind (enum) -> text, so apps can define their own kinds
--  * matterId on platform tables -> generic refType/refId
--  * Matter keeps its table but loses foreign keys to platform tables (it is owned by the legal app)
-- Existing data is carried over.

-- Organization: vertical -> app, modules
ALTER TABLE "Organization" ADD COLUMN "app" TEXT;
UPDATE "Organization" SET "app" = lower("vertical"::text);
ALTER TABLE "Organization" ALTER COLUMN "app" SET NOT NULL;
ALTER TABLE "Organization" ADD COLUMN "modules" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Organization" SET "modules" = CASE "app" WHEN 'clinic' THEN ARRAY['queue','appointments'] ELSE ARRAY['appointments'] END;
ALTER TABLE "Organization" DROP COLUMN "vertical";
DROP TYPE "Vertical";

-- CatalogItem.kind: enum -> text
ALTER TABLE "CatalogItem" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
DROP TYPE "CatalogKind";

-- matterId -> refType/refId
ALTER TABLE "Document" DROP CONSTRAINT "Document_matterId_fkey";
ALTER TABLE "Encounter" DROP CONSTRAINT "Encounter_matterId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_matterId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT "Task_matterId_fkey";
ALTER TABLE "Matter" DROP CONSTRAINT "Matter_contactId_fkey";
ALTER TABLE "Matter" DROP CONSTRAINT "Matter_orgId_fkey";

ALTER TABLE "Document" ADD COLUMN "refType" TEXT, ADD COLUMN "refId" TEXT;
ALTER TABLE "Encounter" ADD COLUMN "refType" TEXT, ADD COLUMN "refId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "refType" TEXT, ADD COLUMN "refId" TEXT;
ALTER TABLE "Task" ADD COLUMN "refType" TEXT, ADD COLUMN "refId" TEXT;

UPDATE "Document" SET "refType" = 'matter', "refId" = "matterId" WHERE "matterId" IS NOT NULL;
UPDATE "Encounter" SET "refType" = 'matter', "refId" = "matterId" WHERE "matterId" IS NOT NULL;
UPDATE "Invoice" SET "refType" = 'matter', "refId" = "matterId" WHERE "matterId" IS NOT NULL;
UPDATE "Task" SET "refType" = 'matter', "refId" = "matterId" WHERE "matterId" IS NOT NULL;

ALTER TABLE "Document" DROP COLUMN "matterId";
ALTER TABLE "Encounter" DROP COLUMN "matterId";
ALTER TABLE "Invoice" DROP COLUMN "matterId";
ALTER TABLE "Task" DROP COLUMN "matterId";

CREATE INDEX "Document_orgId_refType_refId_idx" ON "Document"("orgId", "refType", "refId");
CREATE INDEX "Encounter_orgId_refType_refId_idx" ON "Encounter"("orgId", "refType", "refId");
CREATE INDEX "Invoice_orgId_refType_refId_idx" ON "Invoice"("orgId", "refType", "refId");
CREATE INDEX "Task_orgId_refType_refId_idx" ON "Task"("orgId", "refType", "refId");
CREATE INDEX "Matter_orgId_contactId_idx" ON "Matter"("orgId", "contactId");
