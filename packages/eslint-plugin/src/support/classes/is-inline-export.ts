import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function isInlineExport(statement: TSESTree.ProgramStatement): statement is TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration {
  return statement.type === AST_NODE_TYPES.ExportNamedDeclaration || statement.type === AST_NODE_TYPES.ExportDefaultDeclaration;
}
