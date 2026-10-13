import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isFunction } from '../classes/is-function.js';

/**
 * Whether an object literal stands for a value: one entry at least that is not a function. An
 * object of functions only is behaviour (a specification, a strategy), not a value.
 */
export function holdsData(object: TSESTree.ObjectExpression): boolean {
  return object.properties.some(
    (property) =>
      property.type === AST_NODE_TYPES.SpreadElement ||
      (property.kind === 'init' && !property.method && !isFunction(property.value)),
  );
}
