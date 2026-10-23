import { describe, expect, it } from 'vitest';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { traceText } from '../src/rebac.js';
import { ada, authorizerWith, docsPermissions, document, fact } from './support/documents.js';

const edit = docsPermissions['document.edit'];
const view = docsPermissions['document.view'];
const sign = docsPermissions['document.sign'];
const viewFolder = docsPermissions['folder.view'];

describe('RelationBasedAuthorizer.explain', () => {
  it('tells why a permission holds: every way, each question on one line, the tuples that answered it', async () => {
    const authorizer = await authorizerWith([
      fact('document:1', 'editor', 'group:eng'),
      fact('group:eng', 'member', 'user:ada'),
      fact('document:1', 'approver', 'user:ada'),
    ]);

    const { decision, trace } = await authorizer.explain({ actor: ada, permission: sign, resource: document('1') });

    expect(decision).toEqual({ allowed: true });

    expect(traceText(trace)).toBe(
      [
        '  document:1 docs:document.sign = all of: approver, docs:document.edit',
        '    user:ada is approver of document:1: the actor',
        '    document:1 docs:document.edit = any of: owner, editor, edit via parent; but not: banned',
        'x     nobody is owner of document:1',
        '      the members of group:eng are editor of document:1',
        '        user:ada is member of group:eng: the actor',
        'x     document:1 has no parent',
        'x     nobody is banned of document:1',
      ].join('\n'),
    );
  });

  it('tells why a permission does not hold: every way tried, and where each one stopped', async () => {
    const authorizer = await authorizerWith([
      fact('group:finance', 'member', 'user:ada'),
      fact('folder:reports', 'viewer', 'group:finance'),
      fact('document:q3', 'parent', 'folder:reports'),
    ]);

    const { decision, trace } = await authorizer.explain({ actor: ada, permission: edit, resource: document('q3') });

    expect(decision).toEqual({ allowed: false, reason: 'NO_RELATION' });

    expect(traceText(trace)).toBe(
      [
        '  document:q3 docs:document.edit = any of: owner, editor, edit via parent; but not: banned',
        'x   nobody is owner of document:q3',
        'x   nobody is editor of document:q3',
        '    folder:reports edit (parent of document:q3) = any of: owner, edit via parent',
        'x     nobody is owner of folder:reports',
        'x     folder:reports has no parent',
      ].join('\n'),
    );

    const viewing = await authorizer.explain({ actor: ada, permission: view, resource: document('q3') });

    expect(viewing.decision).toEqual({ allowed: true });

    expect(traceText(viewing.trace)).toContain(
      [
        '      the members of group:finance are viewer of folder:reports',
        '        user:ada is member of group:finance: the actor',
      ].join('\n'),
    );
  });

  it('shows where a cycle and the depth limit cut the evaluation', async () => {
    const looping = await authorizerWith(
      [fact('folder:x', 'parent', 'folder:y'), fact('folder:y', 'parent', 'folder:x')],
      { maxDepth: 3 },
    );

    const { decision, trace } = await looping.explain({
      actor: ada,
      permission: viewFolder,
      resource: { type: 'folder', id: 'x' },
    });

    expect(decision).toEqual({ allowed: false, reason: 'DEPTH_EXCEEDED' });

    const cuts = trace.filter((step) => step.answer === 'cut').map((step) => step.text);

    expect(cuts).toContain('folder:x edit (parent of folder:y): already being asked above, a cycle in the tuples');
    expect(cuts).toContain('folder:y owner: the depth limit (3) cuts here');
  });

  it('explains nothing for the anonymous actor, a check without a resource or a permission the type does not derive', async () => {
    const authorizer = await authorizerWith([fact('document:1', 'owner', 'user:ada')]);

    expect(await authorizer.explain({ actor: anonymousActor(), permission: edit, resource: document('1') })).toEqual({
      decision: { allowed: false, reason: 'ANONYMOUS' },
      trace: [],
    });

    expect(await authorizer.explain({ actor: ada, permission: edit })).toEqual({
      decision: { allowed: false, reason: 'RESOURCE_REQUIRED' },
      trace: [],
    });

    expect(await authorizer.explain({ actor: ada, permission: viewFolder, resource: document('1') })).toEqual({
      decision: { allowed: false, reason: 'UNMAPPED_PERMISSION' },
      trace: [],
    });
  });
});
