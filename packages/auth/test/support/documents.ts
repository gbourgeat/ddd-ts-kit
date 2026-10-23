import type { Actor } from '@ddd-ts-kit/kernel';
import { definePermissions, type Decision, type Permission, type ResourceRef } from '../../src/index.js';
import {
  InMemoryRelationTupleStore,
  RelationBasedAuthorizer,
  defineSchema,
  via,
  type RelationBasedAuthorizerOptions,
  type RelationTuple,
} from '../../src/rebac.js';

export const docsPermissions = definePermissions('docs', {
  'document.edit': { description: 'Change a document' },
  'document.view': { description: 'Read a document' },
  'document.sign': { description: 'Sign a document' },
  'folder.view': { description: 'See what a folder holds' },
});

const editDocument = docsPermissions['document.edit'].id;
const viewDocument = docsPermissions['document.view'].id;
const signDocument = docsPermissions['document.sign'].id;
const viewFolder = docsPermissions['folder.view'].id;

/** Every shape of derived relation: a name, `via`, `anyOf`, `allOf`, `butNot`, and a group standing for its members. */
export const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  folder: {
    relations: { owner: ['user'], viewer: ['user', 'group#member'], parent: ['folder'] },
    derived: {
      edit: { anyOf: ['owner', via('parent', 'edit')] },
      [viewFolder]: { anyOf: ['edit', 'viewer', via('parent', viewFolder)] },
    },
  },
  document: {
    relations: {
      owner: ['user'],
      editor: ['user', 'group#member'],
      viewer: ['user', 'group#member'],
      banned: ['user'],
      approver: ['user'],
      parent: ['folder'],
    },
    derived: {
      [editDocument]: { anyOf: ['owner', 'editor', via('parent', 'edit')], butNot: ['banned'] },
      [viewDocument]: { anyOf: [editDocument, 'viewer', via('parent', viewFolder)], butNot: ['banned'] },
      [signDocument]: { allOf: ['approver', editDocument] },
    },
  },
});

export function user(id: string): Actor {
  return { id, type: 'user', roles: [], attributes: {} };
}

export function fact(object: string, relation: string, subject: string): RelationTuple {
  return { object, relation, subject };
}

export async function authorizerWith(
  tuples: readonly RelationTuple[],
  options: Partial<RelationBasedAuthorizerOptions> = {},
): Promise<RelationBasedAuthorizer> {
  const store = new InMemoryRelationTupleStore();

  await store.write(tuples);

  return new RelationBasedAuthorizer({ schema, store, ...options });
}

export const ada = user('ada');
export const bob = user('bob');

export function document(id: string): ResourceRef {
  return { type: 'document', id };
}

interface Asking {
  readonly actor?: Actor;
  readonly permission?: Permission;
  readonly id?: string;
}

/** By default: may ada edit the document 1, given the tuples. */
export async function allowed(tuples: readonly RelationTuple[], request: Asking): Promise<Decision> {
  const authorizer = await authorizerWith(tuples);
  const { actor = ada, permission = docsPermissions['document.edit'], id = '1' } = request;

  return authorizer.check({ actor, permission, resource: document(id) });
}
