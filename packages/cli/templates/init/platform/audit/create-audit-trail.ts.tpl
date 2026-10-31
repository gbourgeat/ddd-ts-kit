{{#if audit.sql}}
import type { ArchivableAuditTrail, AuditReader, AuditTrail } from '@ddd-ts-kit/audit';
{{/if}}
{{#if audit.memory}}
import { InMemoryAuditTrail, type ArchivableAuditTrail, type AuditReader, type AuditTrail } from '@ddd-ts-kit/audit';
{{/if}}
{{#if audit.knex}}
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';
{{/if}}
{{#if audit.drizzle}}
import { DrizzleAuditTrail } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
{{#if audit.prisma}}
import { PrismaAuditTrail } from '@ddd-ts-kit/audit/prisma';
{{/if}}
{{#if audit.typeorm}}
import { TypeOrmAuditTrail } from '@ddd-ts-kit/audit/typeorm';
{{/if}}
{{#if audit.sql}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{/if}}
{{#if audit.schemaFile}}
import { AUDIT_SCHEMA } from '{{alias.platform}}/database/schema{{alias.ext}}';
{{/if}}

{{#if audit.knex}}
/** The store of the entries in the database of the project: the platform writes it, `scripts/audit-verify.ts` verifies it. */
export function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader & ArchivableAuditTrail {
  return new KnexAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
{{/if}}
{{#if audit.drizzle}}
/** The store of the entries in the database of the project: the platform writes it, `scripts/audit-verify.ts` verifies it. */
export function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader & ArchivableAuditTrail {
  return new DrizzleAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
{{/if}}
{{#if audit.prisma}}
/** The schema the models of the trail declare in prisma/schema/schema.prisma (`@@schema("audit")`). */
const AUDIT_SCHEMA = 'audit';

/** The store of the entries in the database of the project: the platform writes it, `scripts/audit-verify.ts` verifies it. */
export function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader & ArchivableAuditTrail {
  return new PrismaAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
{{/if}}
{{#if audit.typeorm}}
/** The store of the entries in the database of the project: the platform writes it, `scripts/audit-verify.ts` verifies it. */
export function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader & ArchivableAuditTrail {
  return new TypeOrmAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
{{/if}}
{{#if audit.memory}}
/** The store of the entries, in the memory of the process. */
// TODO(platform): the audit package stores on the four ORMs only: write an adapter of AuditTrail and AuditReader for your storage, hold it to `auditTrailContract` of @ddd-ts-kit/audit/testing and answer it here. Until then the entries live in the memory of the process and are lost when it stops.
export function createAuditTrail(): AuditTrail & AuditReader & ArchivableAuditTrail {
  return new InMemoryAuditTrail();
}
{{/if}}
