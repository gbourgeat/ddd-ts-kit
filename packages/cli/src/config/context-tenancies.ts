/**
 * Where a context stands against the tenancy of the project, `contexts.<name>.tenancy`:
 * `control-plane`, the context decides who belongs to which tenant and its tables belong to none.
 * Absent, the context holds tenant data as the project does.
 */
export const CONTEXT_TENANCIES = ['control-plane'] as const;
