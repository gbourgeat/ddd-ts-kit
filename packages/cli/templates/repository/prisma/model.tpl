@@models
model {{context.pascal}}{{aggregate.pascal}} {
  id        String   @id
  createdAt DateTime @map("created_at") @db.Timestamptz(3)
  // TODO(domain): add one field per field of {{aggregate.pascal}}State, with the type and the constraints the storage must enforce; then run `npm run db:client` and `npm run db:generate`.
  version   Int

  @@map("{{aggregate.table}}")
  @@schema("{{context.schema}}")
}
