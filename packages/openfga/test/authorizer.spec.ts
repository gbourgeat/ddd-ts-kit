import { describe, expect, it } from 'vitest';
import { ReverseExpansionLimitError } from '@ddd-ts-kit/auth/rebac';
import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import { OpenFgaAuthorizer, type OpenFgaApi, type OpenFgaTupleKey } from '../src';
import { docsPermissions, schema } from './support/documents';
import { InMemoryOpenFga } from './support/in-memory-open-fga';

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const edit = docsPermissions['document.edit'];

/** A server that allows what it was told to, and records what it was asked. */
class AnsweringOpenFga extends InMemoryOpenFga implements OpenFgaApi {
  readonly asked: OpenFgaTupleKey[] = [];

  constructor(
    private readonly allowed: readonly string[],
    private readonly listed: readonly string[] = ['document:2', 'document:1'],
  ) {
    super();
  }

  override check(body: OpenFgaTupleKey): Promise<{ allowed?: boolean }> {
    this.asked.push(body);

    return Promise.resolve({ allowed: this.allowed.includes(`${body.object}#${body.relation}@${body.user}`) });
  }

  override listObjects(_body: {
    user: string;
    relation: string;
    type: string;
  }): Promise<{ objects: readonly string[] }> {
    return Promise.resolve({ objects: this.listed });
  }
}

describe('OpenFgaAuthorizer', () => {
  it('asks OpenFGA the relation named after the permission, as the model names it, for the subject of the actor', async () => {
    const client = new AnsweringOpenFga(['document:1#docs_document_edit@user:ada']);
    const authorizer = new OpenFgaAuthorizer({ client, schema });

    expect(await authorizer.check({ actor: ada, permission: edit, resource: { type: 'document', id: '1' } })).toEqual({
      allowed: true,
    });

    expect(await authorizer.check({ actor: ada, permission: edit, resource: { type: 'document', id: '2' } })).toEqual({
      allowed: false,
      reason: 'NO_RELATION',
    });

    expect(client.asked[0]).toEqual({ user: 'user:ada', relation: 'docs_document_edit', object: 'document:1' });
  });

  it('refuses the anonymous actor, a check without a resource and a permission the type does not derive, before any call', async () => {
    const client = new AnsweringOpenFga([]);
    const authorizer = new OpenFgaAuthorizer({ client, schema });
    const resource = { type: 'document', id: '1' };

    expect(await authorizer.check({ actor: anonymousActor(), permission: edit, resource })).toMatchObject({
      reason: 'ANONYMOUS',
    });

    expect(await authorizer.check({ actor: ada, permission: edit })).toMatchObject({ reason: 'RESOURCE_REQUIRED' });

    expect(
      await authorizer.check({ actor: ada, permission: edit, resource: { type: 'folder', id: '1' } }),
    ).toMatchObject({
      reason: 'UNMAPPED_PERMISSION',
    });

    expect(client.asked).toEqual([]);
  });

  it('lists the ids OpenFGA reaches, sorted, and nothing for the anonymous actor or a type that does not derive the permission', async () => {
    const authorizer = new OpenFgaAuthorizer({
      client: new AnsweringOpenFga([]),
      schema,
      subjectOf: (actor) => `user:${actor.id}`,
    });

    expect(await authorizer.listAccessible({ actor: ada, permission: edit, resourceType: 'document' })).toEqual({
      kind: 'ids',
      ids: ['1', '2'],
    });

    expect(
      await authorizer.listAccessible({ actor: anonymousActor(), permission: edit, resourceType: 'document' }),
    ).toEqual({
      kind: 'none',
    });

    expect(await authorizer.listAccessible({ actor: ada, permission: edit, resourceType: 'folder' })).toEqual({
      kind: 'none',
    });
  });

  it('refuses a listing as long as the server allows, which the server may have cut without saying so', async () => {
    const truncating = new AnsweringOpenFga([], ['document:1', 'document:2', 'document:3']);
    const request = { actor: ada, permission: edit, resourceType: 'document' };

    await expect(
      new OpenFgaAuthorizer({ client: truncating, schema, listObjectsLimit: 3 }).listAccessible(request),
    ).rejects.toThrow(ReverseExpansionLimitError);

    expect(
      await new OpenFgaAuthorizer({ client: truncating, schema, listObjectsLimit: 4 }).listAccessible(request),
    ).toEqual({
      kind: 'ids',
      ids: ['1', '2', '3'],
    });

    const atTheDefault = new AnsweringOpenFga(
      [],
      Array.from({ length: 1000 }, (_, index) => `document:${index}`),
    );

    await expect(new OpenFgaAuthorizer({ client: atTheDefault, schema }).listAccessible(request)).rejects.toThrow(
      ReverseExpansionLimitError,
    );
  });
});
