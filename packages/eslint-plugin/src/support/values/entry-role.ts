import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { descendants } from '../descendants';
import { JAVASCRIPT_GLOBALS } from './javascript-globals';
import { rootName } from './root-name';
import { unwrapped } from './unwrapped';

/**
 * What an entry of an object literal holds: `behaviour`, a function; `built`, what a call or
 * `new` of the model built (`Money.of(1)`, `total.add(tax)`, `new Slot(..)`), a call of the
 * language aside (`Math.round(..)`, `new Date(..)`); `data`, anything else: a literal, a
 * parameter, an operation on them.
 */
export type EntryRole = 'behaviour' | 'built' | 'data';

/** The role of an expression; a name is read from its declaration in the module, found by name. */
export function expressionRole(
  expression: TSESTree.Expression,
  program: TSESTree.Program,
  seen: ReadonlySet<string> = new Set(),
): EntryRole {
  const inner = unwrapped(expression);

  switch (inner.type) {
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.FunctionExpression: {
      return 'behaviour';
    }
    case AST_NODE_TYPES.CallExpression:
    case AST_NODE_TYPES.NewExpression:
    case AST_NODE_TYPES.ChainExpression: {
      return calledRole(rootName(inner));
    }
    case AST_NODE_TYPES.Identifier: {
      return seen.has(inner.name) ? 'data' : boundRole(program, inner.name, new Set([...seen, inner.name]));
    }
    default: {
      return 'data';
    }
  }
}

/** A call or `new` of the language builds data; any other one, a value of the model. */
function calledRole(root: string | undefined): EntryRole {
  return JAVASCRIPT_GLOBALS.has(root ?? '') ? 'data' : 'built';
}

/** The role of what the first declaration of `name` in the module binds: a parameter, declared nowhere, is data. */
function boundRole(program: TSESTree.Program, name: string, seen: ReadonlySet<string>): EntryRole {
  for (const node of descendants(program)) {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id?.name === name) {
      return 'behaviour';
    }

    if (node.type === AST_NODE_TYPES.VariableDeclarator && node.id.type === AST_NODE_TYPES.Identifier) {
      if (node.id.name === name && node.init !== null) {
        return expressionRole(node.init, program, seen);
      }
    }
  }

  return 'data';
}
