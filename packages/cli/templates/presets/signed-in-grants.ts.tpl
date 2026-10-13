import type { Grant } from '@ddd-ts-kit/auth';

/**
 * What every signed-in person may do, whatever the access model of the platform decides for the
 * rest: the permissions of a context that serves each person for themselves, such as their
 * account and the organisations they belong to, whose own policies decide on the element.
 * `createAuthorizer` grants them before it asks the model.
 */
export const signedInGrants: readonly Grant[] = [
  // ddd-ts-kit:signed-in-grants
  // /ddd-ts-kit:signed-in-grants
];
