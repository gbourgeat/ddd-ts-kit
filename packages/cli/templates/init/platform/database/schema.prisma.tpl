generator client {
  provider            = "prisma-client"
  output              = "../generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
  schemas  = ["messaging"]
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
