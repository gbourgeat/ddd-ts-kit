import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The object and the method of `object.method(..)`, awaited or not. */
export interface CalledMember {
  readonly object: TSESTree.Expression;
  readonly method: string;
}

export function calledMember(init: TSESTree.Expression): CalledMember | undefined {
  const value = init.type === AST_NODE_TYPES.AwaitExpression ? init.argument : init;

  if (value.type !== AST_NODE_TYPES.CallExpression || value.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return undefined;
  }

  const { object, property, computed } = value.callee;

  return computed || property.type !== AST_NODE_TYPES.Identifier ? undefined : { object, method: property.name };
}
