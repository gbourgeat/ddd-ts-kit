import { describe, expect, it } from 'vitest';
import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import { OpenFgaAuthorizer, type OpenFgaApi, type OpenFgaTupleKey } from '../src/index.js';
import { docsPermissions, mapping } from './support/documents.js';
import { InMemoryOpenFga } from './support/in-memory-open-fga.js';

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const edit = docsPermissions['document.edit'];

/** A server that allows what it was told to, and records what it was asked. */
class AnsweringOpenFga extends InMemoryOpenFga implements OpenFgaApi {
  readonly asked: OpenFgaTupleKey[] = [];

  constructor(private readonly allowed: readonly string[]) {
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
    return Promise.resolve({ objects: ['document:2', 'document:1'] });
  }
}

describe('OpenFgaAuthorizer', () => {
  it('asks OpenFGA the relation the permission is mapped to, for the subject of the actor', async () => {
    const client = new AnsweringOpenFga(['document:1#edit@user:ada']);
    const authorizer = new OpenFgaAuthorizer({ client, mapping });

    expect(await authorizer.check({ actor: ada, permission: edit, resource: { type: 'document', id: '1' } })).toEqual({
      allowed: true,
    });

    expect(await authorizer.check({ actor: ada, permission: edit, resource: { type: 'document', id: '2' } })).toEqual({
      allowed: false,
      reason: 'NO_RELATION',
    });

    expect(client.asked[0]).toEqual({ user: 'user:ada', relation: 'edit', object: 'document:1' });
  });

  it('refuses the anonymous actor, a check without a resource and an unmapped permission, before any call', async () => {
    const client = new AnsweringOpenFga([]);
    const authorizer = new OpenFgaAuthorizer({ client, mapping });
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

  it('lists the ids OpenFGA reaches, sorted, and nothing for the anonymous actor or an unmapped type', async () => {
    const authorizer = new OpenFgaAuthorizer({
      client: new AnsweringOpenFga([]),
      mapping,
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
});
