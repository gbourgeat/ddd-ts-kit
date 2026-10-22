import { describe, expect, it } from 'vitest';
import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../src';
import { ReverseExpansionLimitError } from '../src/rebac';
import { ada, authorizerWith, docsPermissions, document, fact, user } from './support/documents';

const edit = docsPermissions['document.edit'];
const view = docsPermissions['document.view'];
const sign = docsPermissions['document.sign'];
const viewFolder = docsPermissions['folder.view'];

describe('RelationBasedAuthorizer.listAccessible', () => {
  const tuples = [
    fact('document:direct', 'owner', 'user:ada'),
    fact('document:team', 'editor', 'group:eng'),
    fact('group:eng', 'member', 'group:platform'),
    fact('group:platform', 'member', 'user:ada'),
    fact('document:filed', 'parent', 'folder:reports'),
    fact('folder:reports', 'parent', 'folder:finance'),
    fact('folder:finance', 'owner', 'user:ada'),
    fact('document:read-only', 'viewer', 'user:ada'),
    fact('document:banned', 'owner', 'user:ada'),
    fact('document:banned', 'banned', 'user:ada'),
    fact('document:other', 'owner', 'user:bob'),
    fact('document:half-signed', 'approver', 'user:ada'),
  ];

  const list = async (actor: Actor, permission: Permission = edit, resourceType = 'document') =>
    (await authorizerWith(tuples)).listAccessible({ actor, permission, resourceType });

  it('finds the elements reached directly, through groups and through parents', async () => {
    expect(await list(ada)).toEqual({ kind: 'ids', ids: ['direct', 'filed', 'team'] });
  });

  it('applies the whole derived relation to each candidate: anyOf, allOf, butNot', async () => {
    expect(await list(ada, view)).toEqual({ kind: 'ids', ids: ['direct', 'filed', 'read-only', 'team'] });
    expect(await list(ada, sign)).toEqual({ kind: 'ids', ids: [] });
  });

  it('agrees with check on every stored document', async () => {
    const authorizer = await authorizerWith(tuples);
    const ids = ['direct', 'team', 'filed', 'read-only', 'banned', 'other', 'half-signed'];
    const checked: string[] = [];

    for (const id of ids) {
      if ((await authorizer.check({ actor: ada, permission: view, resource: document(id) })).allowed) {
        checked.push(id);
      }
    }

    expect(await list(ada, view)).toEqual({ kind: 'ids', ids: checked.sort() });
  });

  it('lists another type by the relation it derives for the permission', async () => {
    expect(await list(ada, viewFolder, 'folder')).toEqual({ kind: 'ids', ids: ['finance', 'reports'] });
  });

  it('lists nothing for a stranger, a permission the type does not derive or the anonymous actor', async () => {
    expect(await list(user('eve'))).toEqual({ kind: 'ids', ids: [] });
    expect(await list(ada, viewFolder, 'document')).toEqual({ kind: 'none' });
    expect(await list(anonymousActor())).toEqual({ kind: 'none' });
  });

  it('gives up loudly beyond its limit instead of returning a partial list', async () => {
    const many = Array.from({ length: 30 }, (_, index) => fact(`document:${index}`, 'owner', 'user:ada'));
    const authorizer = await authorizerWith(many, { listLimit: 10 });

    await expect(
      authorizer.listAccessible({ actor: ada, permission: edit, resourceType: 'document' }),
    ).rejects.toBeInstanceOf(ReverseExpansionLimitError);
  });
});
