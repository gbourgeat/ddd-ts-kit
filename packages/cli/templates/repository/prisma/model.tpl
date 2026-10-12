@@models
model {{context.pascal}}{{aggregate.pascal}} {
  id           String   @id
  registeredAt DateTime @map("registered_at") @db.Timestamptz(3)
  // TODO(domain): add one field per field of {{aggregate.pascal}}State, with the type and the constraints the storage must enforce; then run `npm run db:client` and `npm run db:generate <what-it-does>`.
  version      Int
  createdAt    DateTime @map("created_at") @db.Timestamptz(3)
  createdBy    String   @map("created_by")
  updatedAt    DateTime @map("updated_at") @db.Timestamptz(3)
  updatedBy    String   @map("updated_by")

  @@map("{{aggregate.table}}")
  @@schema("{{context.schema}}")
}
