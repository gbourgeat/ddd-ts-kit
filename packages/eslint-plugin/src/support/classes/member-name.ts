import type { TSESTree } from '@typescript-eslint/utils';
import { keyName } from './key-name';
import { isKeyed } from './is-keyed';

/** `#secret` keeps its hash, so a private name never collides with a public one. */
export function memberName(member: TSESTree.ClassElement): string | undefined {
  return isKeyed(member) && !member.computed ? keyName(member.key) : undefined;
}
