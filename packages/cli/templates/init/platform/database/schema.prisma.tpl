generator client {
  provider            = "prisma-client"
  output              = "../generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
  schemas  = ["messaging"{{#if eventSourcing.on}}, "event_store"{{/if}}{{#if audit.on}}, "audit"{{/if}}]
}

// The outbox and the idempotency table, from @ddd-ts-kit/prisma. Keep the field names: the
// stores are typed against them.
model OutboxRecord {
  id            String    @id
  sequence      BigInt    @unique @default(autoincrement())
  type          String
  version       Int
  occurredAt    String    @map("occurred_at")
  payload       Json?
  traceparent   String?
  correlationId String?   @map("correlation_id")
{{#if tenancy.any}}
  /// The tenant of the event, so that its consumers run in that tenant.
  tenantId      String?   @map("tenant_id")
{{/if}}
  status        String    @default("pending")
  attempts      Int       @default(0)
  nextAttemptAt DateTime  @map("next_attempt_at") @db.Timestamptz(3)
  lastErrorCode String?   @map("last_error_code")
  publishedAt   DateTime? @map("published_at") @db.Timestamptz(3)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([status, nextAttemptAt, sequence])
  @@map("outbox")
  @@schema("messaging")
}

model ProcessedEvent {
  consumer    String
  eventId     String   @map("event_id")
  processedAt DateTime @default(now()) @map("processed_at") @db.Timestamptz(3)

  @@id([consumer, eventId])
  @@map("processed_events")
  @@schema("messaging")
}

// One schema per bounded context, no relation across contexts.
// ddd-ts-kit:models
// /ddd-ts-kit:models
{{#if eventSourcing.on}}

// The event store of @ddd-ts-kit/prisma: the events, the snapshots, the checkpoints and the
// keys of the data subjects. Keep the table and column names: the stores run raw statements
// against them. It records no tenant.
model StoredEventsHead {
  id       Int    @id @db.SmallInt
  position BigInt

  @@map("stored_events_head")
  @@schema("event_store")
}

model StoredEvent {
  position      BigInt   @id
  stream        String
  version       Int
  eventId       String   @unique @map("event_id")
  type          String
  schemaVersion Int      @map("schema_version")
  data          Json
  metadata      Json
  occurredAt    DateTime @map("occurred_at") @db.Timestamptz(3)
  recordedAt    DateTime @default(now()) @map("recorded_at") @db.Timestamptz(3)

  @@unique([stream, version])
  @@map("stored_events")
  @@schema("event_store")
}

model StreamSnapshot {
  stream        String   @id
  version       Int
  schemaVersion Int      @map("schema_version")
  data          Json
  takenAt       DateTime @default(now()) @map("taken_at") @db.Timestamptz(3)

  @@map("stream_snapshots")
  @@schema("event_store")
}

model SubscriptionCheckpoint {
  subscriber String   @id
  position   BigInt
  updatedAt  DateTime @default(now()) @map("updated_at") @db.Timestamptz(3)

  @@map("subscription_checkpoints")
  @@schema("event_store")
}

/// One key per data subject: erasing the subject deletes its row.
model SubjectKey {
  subject   String   @id
  keyId     String   @unique @map("key_id")
  material  String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  @@map("subject_keys")
  @@schema("event_store")
}
{{/if}}
{{#if audit.on}}

// TODO(platform): Prisma writes no trigger. After the first `npm run db:generate <name>`, add a migration (`npm run db:generate audit-guard`) holding the statements `npm run db:audit-guard` prints: they make the entries refuse UPDATE, DELETE and TRUNCATE.
/// The audit trail of @ddd-ts-kit/audit: written by PrismaAuditTrail with raw statements, append-only once the guard is migrated.
model AuditEntry {
  id             String   @unique
  chain          String
  sequence       BigInt
  occurredAt     DateTime @map("occurred_at") @db.Timestamptz(3)
  category       String
  action         String
  outcome        String
  reason         String?
  actorId        String   @map("actor_id")
  actorType      String   @map("actor_type")
  actorTenantId  String?  @map("actor_tenant_id")
  tenantId       String?  @map("tenant_id")
  impersonatedBy String?  @map("impersonated_by")
  sessionId      String?  @map("session_id")
  resourceType   String?  @map("resource_type")
  resourceId     String?  @map("resource_id")
  context        String?
  correlationId  String   @map("correlation_id")
  causationId    String?  @map("causation_id")
  origin         String
  changes        Json?
  extensions     Json     @default("{}")
  previousHash   String   @map("previous_hash")
  hash           String

  @@id([chain, sequence])
  @@index([occurredAt, chain, sequence], map: "audit_entries_occurred_idx")
  @@index([actorId, occurredAt], map: "audit_entries_actor_idx")
  @@index([resourceType, resourceId], map: "audit_entries_resource_idx")
  @@index([correlationId], map: "audit_entries_correlation_idx")
  @@map("audit_entries")
  @@schema("audit")
}

/// The archives of the audit trail: one row per range of a chain written to the file storage, append-only, read by the guard.
model AuditArchive {
  chain        String
  fromSequence BigInt   @map("from_sequence")
  toSequence   BigInt   @map("to_sequence")
  lastHash     String   @map("last_hash")
  entries      Int
  fileKey      String   @map("file_key")
  fileDigest   String   @map("file_digest")
  archivedAt   DateTime @map("archived_at") @db.Timestamptz(3)

  @@id([chain, toSequence])
  @@map("audit_archives")
  @@schema("audit")
}

/// The head of each chain of the audit trail: the row an append locks.
model AuditChain {
  chain    String @id
  sequence BigInt
  hash     String

  @@map("audit_chains")
  @@schema("audit")
}
{{/if}}
