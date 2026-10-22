import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isInlineExport } from './is-inline-export';

/** The classes declared at the top of a module, exported or not. */
export function topLevelClasses(program: TSESTree.Program): TSESTree.ClassDeclaration[] {
  return program.body.flatMap((statement) => {
    const declaration = isInlineExport(statement) ? statement.declaration : statement;

    return declaration?.type === AST_NODE_TYPES.ClassDeclaration ? [declaration] : [];
  });
}
