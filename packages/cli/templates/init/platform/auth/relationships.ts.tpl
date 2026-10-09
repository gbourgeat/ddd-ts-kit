import {
  InMemoryRelationTupleStore,
  SchemaCheckedTupleStore,
  defineSchema,
  union,
  type PermissionMapping,
  type RelationTupleStore,
} from '@ddd-ts-kit/auth/rebac';
import { permissionRegistry } from './permissions.js';

/**
 * One example type: a bounded context and who operates it. Use cases start by naming their
 * context as the resource (`{ type: 'context', id: '<context>' }`).
 */
// TODO(platform): model the elements rights are shared on (documents, folders, teams), name them in the `resource` of each requirement and map each permission to a permission of its type.
export const RELATIONSHIP_SCHEMA = defineSchema({
  user: {},
  context: {
    relations: { operator: ['user'] },
    permissions: { operate: union('operator') },
  },
});

// TODO(platform): bind a persistent store (a table written in the transaction of the change it describes) and hold it to relationTupleStoreContract, as relationships.contract.spec.ts does for this one.
export function createTupleStore(): RelationTupleStore {
  return new InMemoryRelationTupleStore();
}

export const relationTuples: RelationTupleStore = new SchemaCheckedTupleStore(RELATIONSHIP_SCHEMA, createTupleStore());

export function permissionMapping(): PermissionMapping {
  return { context: Object.fromEntries(permissionRegistry.all().map((permission) => [permission.id, 'operate'])) };
}
