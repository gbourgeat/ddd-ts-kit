generator client {
  provider            = "prisma-client"
  output              = "../generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
  schemas  = ["messaging"{{#if eventSourcing.on}}, "event_store"{{/if}}]
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
