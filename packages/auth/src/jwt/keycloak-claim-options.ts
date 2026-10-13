export interface KeycloakClaimOptions {
  /** The client whose roles (`resource_access.<clientId>.roles`) join the realm roles. */
  readonly clientId?: string;
  /**
   * The claim holding the tenant. Default `tenant_id`; `organization` reads the organizations of
   * the user: one is the tenant, several are its `tenants`, among which a request names one.
   */
  readonly tenantClaim?: string;
  /** The claim written by the group membership mapper. Default `groups`. */
  readonly groupsClaim?: string;
}
