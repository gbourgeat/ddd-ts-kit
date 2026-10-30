import { defineSchema, type SchemaDefinition } from '@ddd-ts-kit/auth/rebac';
import { permissions } from '{{alias.platform}}/auth/authorization/permissions{{alias.ext}}';

/**
 * The elements rights are shared on (documents, folders, teams): a type each, with who is what to
 * it (the relations, stored as tuples) and which permission it grants (a derived relation named
 * after a permission id grants it on that type). A permission derived on an element leaves the
 * context below: the operators of the context no longer hold it, so name that element in the
 * `resource` of the requirement, never the context.
 */
// TODO(platform): model the elements rights are shared on (documents, folders, teams), name them in the `resource` of each requirement and derive each permission on its type.
const elements: SchemaDefinition = {};

const modelledOnAnElement = new Set(Object.values(elements).flatMap((element) => Object.keys(element.derived ?? {})));

/**
 * Who is what to which element, who counts as what (the derived relations), and which permission
 * each one grants. A bounded context and who operates it is the example type: a use case on no
 * element names its context as the resource (`{ type: 'context', id: '<context>' }`), and the
 * operators of the context hold every permission no element derives. A system actor (a scheduled
 * job, an integration event handler) is a subject of type `system`.
{{#if tenancy.any}}
 * A tuple names no tenant: the operator of a context operates it in every tenant, so decide per
 * tenant what a use case on no element allows (roles with the tenant check, or an object that
 * names the tenant), and keep the relationships for the elements, whose ids no two tenants share.
{{/if}}
 */
export const relationshipSchema = defineSchema({
  user: {},
  system: {},
  context: {
    relations: { operator: ['user', 'system'] },
    derived: Object.fromEntries(
      permissions
        .all()
        .filter((permission) => !modelledOnAnElement.has(permission.id))
        .map((permission) => [permission.id, 'operator']),
    ),
  },
  ...elements,
});
