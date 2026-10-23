import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryRelationTupleStore } from '../src/rebac';
import { authorizerContract, relationTupleStoreContract } from '../src/testing';
import { ada, authorizerWith, docsPermissions, document, fact } from './support/documents';

const edit = docsPermissions['document.edit'];

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'RelationBasedAuthorizer',
    create: async () => ({
      authorizer: await authorizerWith([
        fact('document:1', 'editor', 'group:eng'),
        fact('group:eng', 'member', 'user:ada'),
        fact('document:2', 'owner', 'user:bob'),
      ]),
      granted: { actor: ada, permission: edit, resource: document('1') },
      refused: { actor: ada, permission: edit, resource: document('2') },
    }),
  },
);

relationTupleStoreContract(
  { describe, it, expect, beforeEach },
  { name: 'InMemoryRelationTupleStore', create: () => new InMemoryRelationTupleStore() },
);
