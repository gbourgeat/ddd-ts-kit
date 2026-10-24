const MODELS = `/// The audit trail of @ddd-ts-kit/audit: written by PrismaAuditTrail with raw statements, append-only once the guard is migrated.
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
  @@schema("{schema}")
}

/// The head of each chain of the audit trail: the row an append locks.
model AuditChain {
  chain    String @id
  sequence BigInt
  hash     String

  @@map("audit_chains")
  @@schema("{schema}")
}
`;

/**
 * The two tables of the trail as Prisma models, to paste in `prisma/schema.prisma` so that the
 * migrations of the project create them, with the columns, the keys and the indexes the SQL of
 * the package gives them, in the given schema (which the `schemas` of the datasource lists). The
 * models are read by no generated client: the trail writes raw statements. The guard that keeps
 * the entries append-only is no model: paste `auditGuardStatements` in a migration created with
 * `prisma migrate dev --create-only`, after the one that creates the tables.
 */
export function auditPrismaModels(schema: string): string {
  return MODELS.replaceAll('{schema}', schema);
}
