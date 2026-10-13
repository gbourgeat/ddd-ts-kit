import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { splitWords } from '../words/split-words.js';
import { singular } from './singular.js';

/** The singular of the last word of a collection named after a concept: `reminder` for `dueReminders` or `this.reminders`. */
export function collectionElement(collection: TSESTree.Expression): string | undefined {
  const named = collection.type === AST_NODE_TYPES.MemberExpression ? collection.property : collection;

  if (named.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  return singular(splitWords(named.name).at(-1) ?? '');
}
