import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { descendants } from '../descendants';
import type { FunctionNode } from '../functions/function-node';
import { unwrapped } from './unwrapped';

const FUNCTIONS = new Set<string>([
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
]);

/**
 * The object literals a function answers by itself: the expression of an arrow, or what a
 * `return` of its own body gives back. A `return` of a function nested in it answers for that one.
 */
export function answeredObjects(node: FunctionNode): TSESTree.ObjectExpression[] {
  const { body } = node;

  if (body.type !== AST_NODE_TYPES.BlockStatement) {
    return objectOf(body);
  }

  return ownReturns(body).flatMap((statement) => (statement.argument === null ? [] : objectOf(statement.argument)));
}

function ownReturns(body: TSESTree.BlockStatement): TSESTree.ReturnStatement[] {
  return [...descendants(body)].filter(
    (node): node is TSESTree.ReturnStatement =>
      node.type === AST_NODE_TYPES.ReturnStatement && enclosingFunction(node) === body.parent,
  );
}

function enclosingFunction(node: TSESTree.Node): TSESTree.Node | undefined {
  let current = node.parent;

  while (current !== undefined && !FUNCTIONS.has(current.type)) {
    current = current.parent;
  }

  return current;
}

function objectOf(expression: TSESTree.Expression): TSESTree.ObjectExpression[] {
  const inner = unwrapped(expression);

  return inner.type === AST_NODE_TYPES.ObjectExpression ? [inner] : [];
}
