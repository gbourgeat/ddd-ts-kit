import type { TSESTree } from '@typescript-eslint/utils';
import { keyName } from './key-name.js';
import { isKeyed } from './is-keyed.js';

/** `#secret` keeps its hash, so a private name never collides with a public one. */
export function memberName(member: TSESTree.ClassElement): string | undefined {
  return isKeyed(member) && !member.computed ? keyName(member.key) : undefined;
}
