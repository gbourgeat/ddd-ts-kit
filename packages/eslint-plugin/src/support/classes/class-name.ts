import type { TSESTree } from '@typescript-eslint/utils';

export type ClassNode = TSESTree.ClassDeclaration | TSESTree.ClassExpression;

export function className(node: ClassNode): string {
  return node.id?.name ?? 'the class';
}
