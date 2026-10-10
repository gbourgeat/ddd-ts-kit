import type { Grant } from '@ddd-ts-kit/auth';

/**
 * What each role may do. A grant is a permission of a context (`billingPermissions['invoice.issue']`,
 * imported from the permissions file of the context), its id, `<context>:*` or `*`. The roles of an
 * actor come from its credential. Integration event handlers and scheduled jobs act as system
 * actors, which carry no role: the authorizer gives them `system`, and `generate job` adds there
 * the permission of the command a job sends.
 */
// TODO(platform): replace this starting point by the roles of the organisation.
export const roles: Readonly<Record<string, readonly Grant[]>> = {
  admin: ['*'],
  system: [
    // ddd-ts-kit:system-grants
    // /ddd-ts-kit:system-grants
  ],
};
