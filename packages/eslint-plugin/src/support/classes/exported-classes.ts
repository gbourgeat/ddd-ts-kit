import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { topLevelClasses } from './top-level-classes.js';
import { isInlineExport } from './is-inline-export.js';

/** Those a module exports: inline, by `export { A }` or by `export default A`. */
export function exportedClasses(program: TSESTree.Program): TSESTree.ClassDeclaration[] {
  const inline = new Set(program.body.flatMap((statement) => (isInlineExport(statement) && statement.declaration?.type === AST_NODE_TYPES.ClassDeclaration ? [statement.declaration] : [])));
  const exportedNames = new Set(program.body.flatMap(exportedLocalNames));

  return topLevelClasses(program).filter((declaration) => inline.has(declaration) || exportedNames.has(declaration.id?.name ?? ''));
}

/** Names exported after their declaration: `export { IssueInvoiceHandler }` and `export default IssueInvoiceHandler`. */
function exportedLocalNames(statement: TSESTree.ProgramStatement): string[] {
  if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) return statement.declaration.type === AST_NODE_TYPES.Identifier ? [statement.declaration.name] : [];
  if (statement.type !== AST_NODE_TYPES.ExportNamedDeclaration || statement.source !== null) return [];

  return statement.specifiers.map((specifier) => specifier.local.name);
}
