/** A stored record that belongs to one tenant. */
export interface TenantScoped {
  readonly tenantId: string;
}
