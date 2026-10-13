import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file.js';

const PASCAL = /^[A-Z][A-Za-z\d]*$/;

/**
 * The class of the project an initializer builds, `X.create(..)` or `new X(..)`: a class of the
 * file, or one imported from the project. A class of a package or of the language (`new Map()`)
 * says nothing of the business.
 */
export function builtClass(
  sourceCode: Readonly<TSESLint.SourceCode>,
  file: LintedFile,
  init: TSESTree.Expression,
): string | undefined {
  const callee = builtCallee(init);

  if (callee === undefined || !PASCAL.test(callee.name)) {
    return undefined;
  }

  const definition = ASTUtils.findVariable(sourceCode.getScope(callee), callee.name)?.defs[0];

  if (definition?.type === TSESLint.Scope.DefinitionType.ClassName) {
    return callee.name;
  }

  const imported =
    definition?.type === TSESLint.Scope.DefinitionType.ImportBinding &&
    definition.parent.type === AST_NODE_TYPES.ImportDeclaration &&
    isProjectSpecifier(file, definition.parent.source.value);

  return imported ? callee.name : undefined;
}

function builtCallee(init: TSESTree.Expression): TSESTree.Identifier | undefined {
  const value = init.type === AST_NODE_TYPES.AwaitExpression ? init.argument : init;

  if (value.type === AST_NODE_TYPES.NewExpression) {
    return value.callee.type === AST_NODE_TYPES.Identifier ? value.callee : undefined;
  }

  if (value.type !== AST_NODE_TYPES.CallExpression || value.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return undefined;
  }

  const { object, property } = value.callee;

  const creates = !value.callee.computed && property.type === AST_NODE_TYPES.Identifier && property.name === 'create';

  return creates && object.type === AST_NODE_TYPES.Identifier ? object : undefined;
}

function isProjectSpecifier(file: LintedFile, specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith(file.config.importAlias);
}
