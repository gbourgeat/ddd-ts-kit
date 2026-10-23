import { describe, expect, it } from 'vitest';
import { descendants } from '../src/support/descendants';
import type { TSESTree } from '@typescript-eslint/utils';

const identifier = (name: string, range: [number, number]): TSESTree.Identifier =>
  ({
    type: 'Identifier',
    name,
    range,
    loc: { start: { line: 1, column: range[0] }, end: { line: 1, column: range[1] } },
  }) as TSESTree.Identifier;

describe('descendants', () => {
  it('walks a node and every node below it, in source order, and never through parent', () => {
    const callee = identifier('run', [0, 3]);
    const argument = identifier('task', [4, 8]);

    const call = {
      type: 'CallExpression',
      callee,
      arguments: [argument],
      optional: false,
      range: [0, 9],
    } as unknown as TSESTree.CallExpression;

    callee.parent = call;
    argument.parent = call;

    expect([...descendants(call)]).toEqual([call, callee, argument]);
  });

  it('walks nothing for what is not a node: a body a parser leaves null, as the JS plugin API of Oxlint does', () => {
    expect([...descendants(null)]).toEqual([]);
    expect([...descendants(undefined)]).toEqual([]);
  });
});
