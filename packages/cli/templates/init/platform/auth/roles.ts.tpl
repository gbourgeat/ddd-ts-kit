import type { Grant } from '@ddd-ts-kit/auth';

/**
 * What each role may do. A grant is a permission of a context (`billingPermissions['invoice.issue']`,
 * imported from the module file of the context), its id, `<context>:*` or `*`. The roles of an
 * actor come from its credential. Integration event handlers act as system actors: give them a role with `systemRole`.
 */
// TODO(platform): replace this starting point by the roles of the organisation.
export const ROLES: Readonly<Record<string, readonly Grant[]>> = {
  admin: ['*'],
};
