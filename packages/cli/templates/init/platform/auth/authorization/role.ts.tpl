/**
 * The roles a credential carries, each written once: a grant, a policy or a guard names one as
 * `Role.Admin`, never as a string, and `generate route-group --role <role>` adds the role it
 * requires.
 */
// TODO(platform): replace this starting point by the roles of the organisation.
export const Role = {
  Admin: 'admin',
{{#if authz.rbac}}
  System: 'system',
{{/if}}
} as const;

export type Role = (typeof Role)[keyof typeof Role];
