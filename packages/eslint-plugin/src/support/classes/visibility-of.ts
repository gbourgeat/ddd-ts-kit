import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isKeyed } from './is-keyed';

export type Visibility = 'public' | 'protected' | 'private';

export function visibilityOf(member: TSESTree.ClassElement): Visibility {
  if (!isKeyed(member)) {
    return 'public';
  }

  if (member.key.type === AST_NODE_TYPES.PrivateIdentifier) {
    return 'private';
  }

  return member.accessibility ?? 'public';
}
