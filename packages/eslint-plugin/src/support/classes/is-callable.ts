import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isFunction } from './is-function';

/** A method with a body, or a property holding a function: what a reader calls a method. */
export type Callable =
  | (TSESTree.MethodDefinition & { readonly value: TSESTree.FunctionExpression })
  | (TSESTree.PropertyDefinition & { readonly value: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression });

export function isCallable(member: TSESTree.ClassElement): member is Callable {
  if (member.type === AST_NODE_TYPES.MethodDefinition) {
    return member.kind !== 'constructor' && member.value.type === AST_NODE_TYPES.FunctionExpression;
  }

  return member.type === AST_NODE_TYPES.PropertyDefinition && member.value !== null && isFunction(member.value);
}
