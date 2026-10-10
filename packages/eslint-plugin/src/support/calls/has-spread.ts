import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** With `{ ...defaults }` a key may be there without being written: the object cannot be judged for what it lacks. */
export function hasSpread(object: TSESTree.ObjectExpression): boolean {
  return object.properties.some((property) => property.type === AST_NODE_TYPES.SpreadElement);
}
