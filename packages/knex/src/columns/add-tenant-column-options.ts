/** A table of tenant data created before its project became multi-tenant. */
export interface AddTenantColumnOptions {
  readonly table: string;
  /** The schema of the table. Default: the default schema of the connection. */
  readonly schema?: string;
  /** The primary key the tenant index leads to. Default `id`. */
  readonly key?: string;
  /**
   * The tenant every row already there belongs to: the one customer the project served. Required
   * when the table holds rows; an empty table needs none.
   */
  readonly tenantOfExistingRows?: string;
}
