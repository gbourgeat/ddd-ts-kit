@@models
model {{context.pascal}}{{name.pascal}} {
  id String @id
{{#if fields.any}}
{{fields.prismaModel}}
{{/if}}
{{#if tenant.scoped}}
  tenantId String @map("tenant_id")
{{/if}}
  /// The event that last changed the row: an older one changes nothing.
  lastEventId String @map("last_event_id")
  lastEventAt DateTime @map("last_event_at") @db.Timestamptz(3)
  lastEventVersion BigInt? @map("last_event_version")
  /// The trace of a removed row, so that a late event does not bring it back.
  deleted Boolean @default(false)

{{#if tenant.scoped}}
  @@index([tenantId, id], map: "{{table}}_tenant_idx")
{{/if}}
  @@map("{{table}}")
  @@schema("{{context.schema}}")
}
