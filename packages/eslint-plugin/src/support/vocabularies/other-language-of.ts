import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file';
import { type ImportTarget, resolveImport } from '../../project/resolve-import';
import { inLayer } from '../imports/in-layer';
import { isOutsidePlace } from './is-outside-place';

/**
 * The names a file reads from another language, with where they come from
 * (`catalog/published-language`, `"legacy-erp"`, `this file`), in source order: a name imported
 * from a published language (its own context's included, the contract being a language of its
 * own), a type imported from a package, a name imported from `infrastructure/anti-corruption/` or
 * `infrastructure/external/` of a context, and in those two folders the interfaces and type
 * aliases the file declares at its top, which describe an outside record as it arrives. The model
 * of a context reads none: `domain/` speaks the language of its context only.
 */
export function otherLanguageOf(file: LintedFile, program: TSESTree.Program): Map<string, string> {
  const names = new Map<string, string>();

  if (inLayer(file, 'domain') !== undefined) {
    return names;
  }

  for (const statement of program.body) {
    const place = statement.type === AST_NODE_TYPES.ImportDeclaration ? importedPlace(file, statement) : undefined;

    if (place !== undefined) {
      for (const name of place.names) {
        names.set(name, place.where);
      }
    }
  }

  if (isOutsidePlace(file.location)) {
    for (const name of program.body.flatMap(declaredTypeName)) {
      names.set(name, 'this file');
    }
  }

  return names;
}

/** Where an import comes from when it is another language, and the names it takes from there. */
function importedPlace(
  file: LintedFile,
  statement: TSESTree.ImportDeclaration,
): { readonly where: string; readonly names: readonly string[] } | undefined {
  const target = resolveImport(file.config, file.path, statement.source.value);
  const where = otherPlace(target);

  const taken = statement.specifiers.filter(
    (specifier) =>
      target.kind !== 'package' ||
      statement.importKind === 'type' ||
      (specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type'),
  );

  return where === undefined ? undefined : { where, names: taken.map((specifier) => specifier.local.name) };
}

function otherPlace(target: ImportTarget): string | undefined {
  if (target.kind === 'package') {
    return `"${target.name}"`;
  }

  const location = target.kind === 'file' ? target.location : undefined;

  if (location?.area !== 'context') {
    return undefined;
  }

  if (location.layer === 'published-language') {
    return `${location.context}/published-language`;
  }

  return isOutsidePlace(location) ? `${location.context}/infrastructure/${location.inside[0] ?? ''}` : undefined;
}

/** The name of an interface or a type alias declared at the top of the file, exported or not. */
function declaredTypeName(statement: TSESTree.ProgramStatement): string[] {
  const declared =
    statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    statement.type === AST_NODE_TYPES.ExportDefaultDeclaration
      ? statement.declaration
      : statement;

  return declared?.type === AST_NODE_TYPES.TSInterfaceDeclaration ||
    declared?.type === AST_NODE_TYPES.TSTypeAliasDeclaration
    ? [declared.id.name]
    : [];
}
