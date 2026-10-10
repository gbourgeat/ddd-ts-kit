import type { TSESTree } from '@typescript-eslint/utils';

export interface MemberUse {
  readonly name: string;
  readonly owner: TSESTree.ClassElement;
  readonly node: TSESTree.MemberExpression;
}
