import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The expression under `as ..`, `satisfies ..` and `!`, which change its type and not what it is. */
export function unwrapped(expression: TSESTree.Expression): TSESTree.Expression {
  if (
    expression.type === AST_NODE_TYPES.TSAsExpression ||
    expression.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    expression.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    return unwrapped(expression.expression);
  }

  return expression;
}
