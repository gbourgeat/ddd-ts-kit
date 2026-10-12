import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { authorizerContract, relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { authorizationModelOf, modelDrift, OpenFgaAuthorizer, OpenFgaRelationTupleStore } from '../src/index.js';
import { docsPermissions, mapping, schema } from './support/documents.js';
import { freshStore, OPENFGA_URL } from './support/open-fga-server.js';

const runner = { describe: describe.runIf(OPENFGA_URL !== ''), it, expect, beforeEach, afterEach };
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const edit = docsPermissions['document.edit'];

relationTupleStoreContract(runner, {
  name: 'OpenFgaRelationTupleStore on an OpenFGA server',
  create: async () => new OpenFgaRelationTupleStore(await freshStore(schema), schema),
});

authorizerContract(runner, {
  name: 'OpenFgaAuthorizer on an OpenFGA server',
  create: async () => {
    const client = await freshStore(schema);

    await new OpenFgaRelationTupleStore(client, schema).write([
      { object: 'document:1', relation: 'editor', subject: 'group:eng#member' },
      { object: 'group:eng', relation: 'member', subject: 'user:ada' },
      { object: 'document:2', relation: 'owner', subject: 'user:bob' },
    ]);

    return {
      authorizer: new OpenFgaAuthorizer({ client, mapping }),
      granted: { actor: ada, permission: edit, resource: { type: 'document', id: '1' } },
      refused: { actor: ada, permission: edit, resource: { type: 'document', id: '2' } },
    };
  },
});

describe.runIf(OPENFGA_URL !== '')('the model generated from the schema, on an OpenFGA server', () => {
  it('is accepted, read back without drift, and decides as the schema says', async () => {
    const client = await freshStore(schema);
    const store = new OpenFgaRelationTupleStore(client, schema);
    const authorizer = new OpenFgaAuthorizer({ client, mapping });
    const document = (id: string) => ({ type: 'document', id });

    await store.write([
      { object: 'folder:f', relation: 'owner', subject: 'user:ada' },
      { object: 'document:1', relation: 'folder', subject: 'folder:f' },
      { object: 'document:2', relation: 'folder', subject: 'folder:f' },
      { object: 'document:2', relation: 'banned', subject: 'user:ada' },
      { object: 'document:1', relation: 'approver', subject: 'user:ada' },
    ]);

    const { authorization_model: served } = await client.readLatestAuthorizationModel();

    expect(modelDrift(authorizationModelOf(schema), served)).toEqual([]);

    expect(await authorizer.check({ actor: ada, permission: edit, resource: document('1') })).toEqual({
      allowed: true,
    });

    expect(await authorizer.check({ actor: ada, permission: edit, resource: document('2') })).toMatchObject({
      allowed: false,
    });

    expect(
      await authorizer.check({ actor: ada, permission: docsPermissions['document.sign'], resource: document('1') }),
    ).toEqual({ allowed: true });

    expect(await authorizer.listAccessible({ actor: ada, permission: edit, resourceType: 'document' })).toEqual({
      kind: 'ids',
      ids: ['1'],
    });
  });
});
