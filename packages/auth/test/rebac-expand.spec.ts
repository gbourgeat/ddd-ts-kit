import { describe, expect, it } from 'vitest';
import { SchemaError, type ExpandNode } from '../src/rebac.js';
import { ada, authorizerWith, docsPermissions, document, fact } from './support/documents.js';

const sign = docsPermissions['document.sign'];
const viewFolder = docsPermissions['folder.view'];

describe('RelationBasedAuthorizer.expand', () => {
  const summary = (node: ExpandNode): unknown => [
    `${node.object}#${node.relation}`,
    node.via,
    node.allowed,
    ...(node.tuple === undefined ? [] : [`@${node.tuple.subject}`]),
    ...(node.children.length === 0 ? [] : [node.children.map(summary)]),
  ];

  it('shows why a permission holds: every branch, with the tuples read', async () => {
    const authorizer = await authorizerWith([
      fact('document:1', 'editor', 'group:eng#member'),
      fact('group:eng', 'member', 'user:ada'),
      fact('document:1', 'approver', 'user:ada'),
    ]);

    const tree = await authorizer.expand({ actor: ada, permission: sign, resource: document('1') });

    expect(summary(tree)).toEqual([
      'document:1#sign',
      'intersection',
      true,
      [
        ['document:1#sign', 'computed', true, [['document:1#approver', 'relation', true, [['document:1#approver', 'direct', true, '@user:ada']]]]],
        [
          'document:1#sign',
          'computed',
          true,
          [
            [
              'document:1#edit',
              'exclusion',
              true,
              [
                [
                  'document:1#edit',
                  'union',
                  true,
                  [
                    ['document:1#edit', 'computed', false, [['document:1#owner', 'relation', false]]],
                    [
                      'document:1#edit',
                      'computed',
                      true,
                      [
                        [
                          'document:1#editor',
                          'relation',
                          true,
                          [
                            [
                              'document:1#editor',
                              'userset',
                              true,
                              '@group:eng#member',
                              [['group:eng#member', 'relation', true, [['group:eng#member', 'direct', true, '@user:ada']]]],
                            ],
                          ],
                        ],
                      ],
                    ],
                    ['document:1#edit', 'from', false],
                  ],
                ],
                ['document:1#edit', 'computed', false, [['document:1#banned', 'relation', false]]],
              ],
            ],
          ],
        ],
      ],
    ]);
  });

  it('shows where a cycle and the depth limit cut the evaluation', async () => {
    const looping = await authorizerWith([fact('folder:x', 'parent', 'folder:y'), fact('folder:y', 'parent', 'folder:x')], {
      maxDepth: 3,
    });

    const vias = (node: ExpandNode): string[] => [node.via, ...node.children.flatMap(vias)];

    const tree = await looping.expand({ actor: ada, permission: viewFolder, resource: { type: 'folder', id: 'x' } });

    expect(tree.allowed).toBe(false);
    expect(vias(tree)).toContain('cycle');
    expect(vias(tree)).toContain('depth-limit');
  });

  it('refuses to explain a permission that is not mapped', async () => {
    const authorizer = await authorizerWith([]);

    await expect(authorizer.expand({ actor: ada, permission: viewFolder, resource: document('1') })).rejects.toBeInstanceOf(
      SchemaError,
    );
  });
});
