import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { hasSpread } from '../calls/has-spread.js';
import { propertyOf } from '../calls/property-of.js';
import { staticString } from '../imports/static-string.js';

/** Why a name is not written where a declaration needs it, in the words of a report. */
type NameProblem = 'missing' | 'empty' | 'not a string literal';

/** The name an options argument writes under `key`: a non-empty string literal, or what stands in its place. */
export function writtenName(options: TSESTree.Node | undefined, key: string): { readonly value: string } | { readonly problem: NameProblem } {
  if (options === undefined) return { problem: 'missing' };

  const property = options.type === AST_NODE_TYPES.ObjectExpression ? propertyOf(options, key) : undefined;

  if (property === undefined) return { problem: options.type === AST_NODE_TYPES.ObjectExpression && !hasSpread(options) ? 'missing' : 'not a string literal' };

  const value = staticString(property.value);

  if (value === undefined) return { problem: 'not a string literal' };

  return value === '' ? { problem: 'empty' } : { value };
}
