/** A table of tenant data: its name, its schema, and its tenant column (`tenant_id` by default). */
export interface TenantTableTarget {
  readonly table: string;
  readonly schema?: string;
  readonly column?: string;
}
