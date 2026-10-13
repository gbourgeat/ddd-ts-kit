/** A table of a context under the schema-per-tenant strategy: its name and the schema of the context. */
export interface TenantSchemaTarget {
  readonly table: string;
  readonly schema: string;
}
