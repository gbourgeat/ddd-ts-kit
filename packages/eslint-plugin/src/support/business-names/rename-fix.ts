import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

/**
 * Renames a variable where it is declared and wherever it is used, its type annotation kept. A
 * shorthand property keeps its key (`{ target }` becomes `{ target: appointment }`). Undefined
 * for an exported variable, whose name other files read.
 */
export function renameFix(variable: TSESLint.Scope.Variable, name: string): TSESLint.ReportFixFunction | undefined {
  const uses = variable.references.map((reference) => reference.identifier);

  if (uses.some((identifier) => identifier.parent.type === AST_NODE_TYPES.ExportSpecifier) || isExported(variable)) {
    return undefined;
  }

  const identifiers = [...variable.identifiers, ...uses].filter(
    (identifier, index, all) => all.findIndex((other) => other.range[0] === identifier.range[0]) === index,
  );

  return (fixer) => identifiers.map((identifier) => renamed(fixer, identifier, name));
}

function renamed(
  fixer: TSESLint.RuleFixer,
  identifier: TSESTree.Identifier | TSESTree.JSXIdentifier,
  name: string,
): TSESLint.RuleFix {
  const { parent } = identifier;
  const own = identifier.name;

  if (parent.type === AST_NODE_TYPES.Property && parent.shorthand && parent.value === identifier) {
    return fixer.replaceText(parent, `${own}: ${name}`);
  }

  return fixer.replaceTextRange([identifier.range[0], identifier.range[0] + own.length], name);
}

function isExported(variable: TSESLint.Scope.Variable): boolean {
  return variable.defs.some((definition) => definition.parent?.parent.type === AST_NODE_TYPES.ExportNamedDeclaration);
}
