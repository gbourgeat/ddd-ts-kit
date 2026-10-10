import { defineSchema, union } from '@ddd-ts-kit/auth/rebac';

/**
 * One example type: a bounded context and who operates it. Use cases start by naming their
 * context as the resource (`{ type: 'context', id: '<context>' }`). A system actor (a scheduled
 * job, an integration event handler) is a subject of type `system`.
 */
// TODO(platform): model the elements rights are shared on (documents, folders, teams), name them in the `resource` of each requirement and map each permission to a permission of its type.
export const relationshipSchema = defineSchema({
  user: {},
  system: {},
  context: {
    relations: { operator: ['user', 'system'] },
    permissions: { operate: union('operator') },
  },
});
