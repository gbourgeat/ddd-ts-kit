import { permit, type AttributePolicy, type Condition } from '@ddd-ts-kit/auth';

const isAdministrator: Condition = ({ actor }) => actor.roles.includes('admin');

/**
 * The rules, over `{ actor, permission, resource, attributes, context, now }`. A matching `forbid`
 * wins over every `permit`; with no matching `permit` the answer is no. Rules that read the
 * resource need a `ResourceAttributes` port given to the authorizer as `attributes`.
 */
// TODO(platform): replace this starting point by the rules of the organisation.
export const ATTRIBUTE_POLICIES: readonly AttributePolicy[] = [permit('administrators-do-everything', ['*'], isAdministrator)];
