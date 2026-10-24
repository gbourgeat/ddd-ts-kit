-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateTable
CREATE TABLE "audit"."audit_entries" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_tenant_id" TEXT,
    "tenant_id" TEXT,
    "impersonated_by" TEXT,
    "session_id" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "context" TEXT,
    "correlation_id" TEXT NOT NULL,
    "causation_id" TEXT,
    "origin" TEXT NOT NULL,
    "changes" JSONB,
    "extensions" JSONB NOT NULL DEFAULT '{}',
    "previous_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("chain","sequence")
);

-- CreateTable
CREATE TABLE "audit"."audit_archives" (
    "chain" TEXT NOT NULL,
    "from_sequence" BIGINT NOT NULL,
    "to_sequence" BIGINT NOT NULL,
    "last_hash" TEXT NOT NULL,
    "entries" INTEGER NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_digest" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_archives_pkey" PRIMARY KEY ("chain","to_sequence")
);

-- CreateTable
CREATE TABLE "audit"."audit_chains" (
    "chain" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_chains_pkey" PRIMARY KEY ("chain")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_entries_id_key" ON "audit"."audit_entries"("id");

-- CreateIndex
CREATE INDEX "audit_entries_occurred_idx" ON "audit"."audit_entries"("occurred_at", "chain", "sequence");

-- CreateIndex
CREATE INDEX "audit_entries_actor_idx" ON "audit"."audit_entries"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_entries_resource_idx" ON "audit"."audit_entries"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_entries_correlation_idx" ON "audit"."audit_entries"("correlation_id");
