import type { ExecutionScope } from '@ddd-ts-kit/kernel';

export interface KnexReadModelOptions<Row> {
  readonly table: string;
  /** The schema of the context. Default: the default schema of the connection. */
  readonly schema?: string;
  /** The column of the key, which is the primary key of the table. Default `id`. */
  readonly keyColumn?: string;
  /** The column of every field of the row: `{ startsAt: 'starts_at' }`. */
  readonly columns: Readonly<Record<keyof Row & string, string>>;
  /**
   * For a read model of tenant data: every row is written with the tenant of the work in
   * progress (`tenant_id`, which `tenantColumn` adds) and every read and write is confined to it,
   * an elevation widening the reads only. Keys stay unique across tenants. Absent: one read model
   * for every tenant, as before.
   */
  readonly tenant?: ExecutionScope;
}
