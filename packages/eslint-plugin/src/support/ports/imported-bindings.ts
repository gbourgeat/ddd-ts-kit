import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { resolveImport } from '../../project/resolve-import.js';
import type { LintedFile } from '../../project/linted-file.js';
import type { ImportedBinding } from './imported-binding.js';

/** The import behind every local name of a program. */
export function importedBindings(file: LintedFile, program: TSESTree.Program): ReadonlyMap<string, ImportedBinding> {
  const imports = program.body.filter((statement) => statement.type === AST_NODE_TYPES.ImportDeclaration);

  const bindings = imports.flatMap((declaration) => {
    const target = resolveImport(file.config, file.path, declaration.source.value);

    return declaration.specifiers.map((specifier): [string, ImportedBinding] => [specifier.local.name, { specifier, declaration, target, typeOnly: isTypeOnly(declaration, specifier) }]);
  });

  return new Map(bindings);
}

function isTypeOnly(declaration: TSESTree.ImportDeclaration, specifier: TSESTree.ImportClause): boolean {
  return declaration.importKind === 'type' || (specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type');
}
