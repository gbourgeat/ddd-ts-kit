import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { staticString } from '../imports/static-string.js';
import { propertyOf } from './property-of.js';
import { hasSpread } from './has-spread.js';

/**
 * The keys of `required` an options argument visibly lacks. An argument that is not an object
 * literal, or that spreads another object, is not judged: nothing is reported as missing.
 */
export function missingKeys(options: TSESTree.Node | undefined, required: readonly string[]): string[] {
  if (options === undefined) {
    return [...required];
  }

  if (options.type !== AST_NODE_TYPES.ObjectExpression || hasSpread(options)) {
    return [];
  }

  return required.filter((key) => !isGiven(propertyOf(options, key)));
}

function isGiven(property: TSESTree.Property | undefined): boolean {
  if (property === undefined) {
    return false;
  }

  const { value } = property;

  if (value.type === AST_NODE_TYPES.Identifier && value.name === 'undefined') {
    return false;
  }

  return staticString(value) !== '';
}
