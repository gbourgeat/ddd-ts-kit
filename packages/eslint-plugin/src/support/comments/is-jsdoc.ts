import { AST_TOKEN_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function isJsdoc(comment: TSESTree.Comment): boolean {
  return comment.type === AST_TOKEN_TYPES.Block && comment.value.startsWith('*') && !comment.value.startsWith('*/');
}
