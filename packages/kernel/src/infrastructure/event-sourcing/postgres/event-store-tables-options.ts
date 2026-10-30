import type { ExecutionScope } from '../../../application/ports/execution-scope';

/** Where the tables of an event store live in PostgreSQL. */
export interface EventStoreTablesOptions {
  /** The schema of the bounded context; created when missing. Without it, the default schema of the connection. */
  readonly schema?: string;
  /**
   * Tenant isolation for a shared-table project, given by a project whose streams belong to
   * tenants: the event store refuses work that names no tenant (`NoCurrentTenantError`), records
   * the tenant of the work at the first append of a stream, in the `tenant_id` column of the events
   * (`eventStoreTablesSql`, `addEventStoreTenantColumn`, or the table of the ORM), refuses a read or
   * an append of a stream of another tenant, and gives each stored event its tenant. Left out, for
   * a project without tenancy, the column is neither read nor written and nothing is refused.
   */
  readonly scope?: ExecutionScope;
}
