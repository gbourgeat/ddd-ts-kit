import { describe, expect, it } from 'vitest';
import { anonymousActor, systemActor } from '@ddd-ts-kit/kernel';
import { RelationBasedAuthorizer, type RelationTupleStore } from '../src/rebac';
import { ada, allowed, authorizerWith, bob, docsPermissions, document, fact, schema } from './support/documents';

const edit = docsPermissions['document.edit'];
const view = docsPermissions['document.view'];
const sign = docsPermissions['document.sign'];

describe('RelationBasedAuthorizer.check, following the derived relations of the schema', () => {
  it('allows through a direct relation', async () => {
    const tuples = [fact('document:1', 'owner', 'user:ada')];

    expect(await allowed(tuples, {})).toEqual({ allowed: true });
    expect(await allowed(tuples, { actor: bob })).toEqual({ allowed: false, reason: 'NO_RELATION' });
    expect(await allowed(tuples, { id: '2' })).toEqual({ allowed: false, reason: 'NO_RELATION' });
  });

  it('allows through a group, which the schema says stands for its members', async () => {
    const tuples = [fact('document:1', 'editor', 'group:eng'), fact('group:eng', 'member', 'user:ada')];

    expect((await allowed(tuples, {})).allowed).toBe(true);
    expect((await allowed(tuples, { actor: bob })).allowed).toBe(false);
  });

  it('allows through groups nested in groups', async () => {
    const tuples = [
      fact('document:1', 'editor', 'group:company'),
      fact('group:company', 'member', 'group:eng'),
      fact('group:eng', 'member', 'group:platform'),
      fact('group:platform', 'member', 'user:ada'),
    ];

    expect((await allowed(tuples, {})).allowed).toBe(true);
  });

  it('derives a permission from another one: who edits also views', async () => {
    const tuples = [fact('document:1', 'editor', 'user:ada'), fact('document:1', 'viewer', 'user:bob')];

    expect((await allowed(tuples, { permission: view })).allowed).toBe(true);
    expect((await allowed(tuples, { actor: bob, permission: view })).allowed).toBe(true);
    expect((await allowed(tuples, { actor: bob, permission: edit })).allowed).toBe(false);
  });

  it('inherits from the parent, at any depth: via', async () => {
    const tuples = [
      fact('document:1', 'parent', 'folder:reports'),
      fact('folder:reports', 'parent', 'folder:finance'),
      fact('folder:finance', 'owner', 'user:ada'),
      fact('folder:reports', 'viewer', 'user:bob'),
    ];

    expect((await allowed(tuples, { permission: edit })).allowed).toBe(true);
    expect((await allowed(tuples, { actor: bob, permission: view })).allowed).toBe(true);
    expect((await allowed(tuples, { actor: bob, permission: edit })).allowed).toBe(false);
  });

  it('requires every way of allOf', async () => {
    const approves = fact('document:1', 'approver', 'user:ada');
    const edits = fact('document:1', 'editor', 'user:ada');

    expect((await allowed([approves], { permission: sign })).allowed).toBe(false);
    expect((await allowed([edits], { permission: sign })).allowed).toBe(false);
    expect((await allowed([approves, edits], { permission: sign })).allowed).toBe(true);
  });

  it('removes those named by butNot from those otherwise allowed', async () => {
    const tuples = [
      fact('document:1', 'owner', 'user:ada'),
      fact('document:1', 'editor', 'user:bob'),
      fact('document:1', 'banned', 'user:bob'),
    ];

    expect((await allowed(tuples, {})).allowed).toBe(true);
    expect((await allowed(tuples, { actor: bob })).allowed).toBe(false);
    expect((await allowed(tuples, { actor: bob, permission: view })).allowed).toBe(false);
  });
});

describe('RelationBasedAuthorizer.check, at its limits', () => {
  it('survives a cycle in the data', async () => {
    const tuples = [
      fact('group:a', 'member', 'group:b'),
      fact('group:b', 'member', 'group:a'),
      fact('folder:x', 'parent', 'folder:y'),
      fact('folder:y', 'parent', 'folder:x'),
      fact('document:1', 'editor', 'group:a'),
      fact('document:1', 'parent', 'folder:x'),
    ];

    expect(await allowed(tuples, {})).toEqual({ allowed: false, reason: 'NO_RELATION' });
    expect((await allowed([...tuples, fact('group:b', 'member', 'user:ada')], {})).allowed).toBe(true);
  });

  it('refuses rather than guess when the depth limit cuts the evaluation', async () => {
    const chain = Array.from({ length: 6 }, (_, level) => fact(`folder:${level}`, 'parent', `folder:${level + 1}`));
    const tuples = [fact('document:1', 'parent', 'folder:0'), ...chain, fact('folder:6', 'owner', 'user:ada')];
    const request = { actor: ada, permission: edit, resource: document('1') };

    expect(await (await authorizerWith(tuples)).check(request)).toEqual({ allowed: true });

    expect(await (await authorizerWith(tuples, { maxDepth: 4 })).check(request)).toEqual({
      allowed: false,
      reason: 'DEPTH_EXCEEDED',
    });
  });

  it('needs a resource: a relation is always to something', async () => {
    const authorizer = await authorizerWith([fact('document:1', 'owner', 'user:ada')]);

    expect(await authorizer.check({ actor: ada, permission: edit })).toEqual({
      allowed: false,
      reason: 'RESOURCE_REQUIRED',
    });
  });

  it('refuses a permission the type of the resource derives no relation for', async () => {
    const authorizer = await authorizerWith([fact('folder:1', 'owner', 'user:ada')]);

    expect(await authorizer.check({ actor: ada, permission: edit, resource: { type: 'folder', id: '1' } })).toEqual({
      allowed: false,
      reason: 'UNMAPPED_PERMISSION',
    });

    expect(await authorizer.check({ actor: ada, permission: edit, resource: { type: 'invoice', id: '1' } })).toEqual({
      allowed: false,
      reason: 'UNMAPPED_PERMISSION',
    });
  });

  it('refuses the anonymous actor without reading a tuple', async () => {
    const reads: string[] = [];

    const store: RelationTupleStore = {
      write: async () => undefined,
      delete: async () => undefined,
      readByObject: async (object) => (reads.push(object), []),
      readBySubject: async (subject) => (reads.push(subject), []),
    };

    const authorizer = new RelationBasedAuthorizer({ schema, store });

    expect(await authorizer.check({ actor: anonymousActor(), permission: edit, resource: document('1') })).toEqual({
      allowed: false,
      reason: 'ANONYMOUS',
    });

    expect(reads).toEqual([]);
  });

  it('names an actor by its type and id, or as the project decides', async () => {
    const job = systemActor('archiver');
    const byDefault = await authorizerWith([fact('document:1', 'viewer', 'user:ada')]);

    const custom = await authorizerWith([fact('document:1', 'viewer', 'user:employee-ada')], {
      subjectOf: (actor) => `user:employee-${actor.id}`,
    });

    const viewing = { permission: view, resource: document('1') };

    expect((await byDefault.check({ ...viewing, actor: ada })).allowed).toBe(true);
    expect((await byDefault.check({ ...viewing, actor: job })).allowed).toBe(false);
    expect((await custom.check({ ...viewing, actor: ada })).allowed).toBe(true);
  });
});
