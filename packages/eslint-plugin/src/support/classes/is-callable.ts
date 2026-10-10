import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isFunction } from './is-function.js';

/** A method with a body, or a property holding a function: what a reader calls a method. */
export function isCallable(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition | TSESTree.PropertyDefinition {
  if (member.type === AST_NODE_TYPES.MethodDefinition) return member.kind !== 'constructor' && member.value.type === AST_NODE_TYPES.FunctionExpression;

  return member.type === AST_NODE_TYPES.PropertyDefinition && member.value !== null && isFunction(member.value);
}
