import { defineSchema } from '@ddd-ts-kit/auth/rebac';
import { permissions } from '{{alias.platform}}/auth/authorization/permissions{{alias.ext}}';

/**
 * Who is what to which element (the relations, stored as tuples), who counts as what (the
 * derived relations), and which permission each one grants: a derived relation named after a
 * permission id grants it on that type. One example type: a bounded context and who operates it.
 * Use cases start by naming their context as the resource (`{ type: 'context', id: '<context>' }`),
 * so every permission of the project is held by the operators of its context until the elements
 * are modelled. A system actor (a scheduled job, an integration event handler) is a subject of
 * type `system`.
 */
// TODO(platform): model the elements rights are shared on (documents, folders, teams), name them in the `resource` of each requirement and derive each permission on its type.
export const relationshipSchema = defineSchema({
  user: {},
  system: {},
  context: {
    relations: { operator: ['user', 'system'] },
    derived: Object.fromEntries(permissions.all().map((permission) => [permission.id, 'operator'])),
  },
});
