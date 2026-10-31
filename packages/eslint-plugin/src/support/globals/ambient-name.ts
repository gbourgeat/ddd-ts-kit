import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { propertyName } from './property-name';

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);

/** How many `const` aliases are followed back to what they name: `const a = Date; const b = a;`. */
const ALIAS_DEPTH = 4;

/**
 * The name under which `node` reaches something ambient: a global or an import binding
 * (`crypto`), also through the global object (`globalThis.crypto`), under the name it is
 * imported by (`vi` for `import { vi as mocks }`) and through a `const` alias of it
 * (`const clock = Date`). Undefined when the name is a local declaration that merely shadows
 * the global.
 */
export function ambientName(sourceCode: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): string | undefined {
  return nameOf(sourceCode, node, 0);
}

function nameOf(sourceCode: Readonly<TSESLint.SourceCode>, node: TSESTree.Node, depth: number): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return identifierName(sourceCode, node, depth);
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression || node.object.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  if (!GLOBAL_OBJECTS.has(node.object.name) || identifierName(sourceCode, node.object, depth) !== node.object.name) {
    return undefined;
  }

  return propertyName(node);
}

function identifierName(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
  depth: number,
): string | undefined {
  const variable = ASTUtils.findVariable(sourceCode.getScope(identifier), identifier.name);

  if (variable === null) {
    return identifier.name;
  }

  if (variable.defs.every((definition) => definition.type === TSESLint.Scope.DefinitionType.ImportBinding)) {
    return importedName(variable.defs[0]?.node) ?? identifier.name;
  }

  const alias = aliasedValue(variable.defs);

  return alias === undefined || depth >= ALIAS_DEPTH ? undefined : nameOf(sourceCode, alias, depth + 1);
}

/** `vi` for `import { vi as mocks }`; nothing for a default or a namespace import, named by the file. */
function importedName(node: TSESTree.Node | undefined): string | undefined {
  if (node?.type !== AST_NODE_TYPES.ImportSpecifier) {
    return undefined;
  }

  return node.imported.type === AST_NODE_TYPES.Identifier ? node.imported.name : node.imported.value;
}

/** What a `const` declared once names, `Date` for `const clock = Date`. */
function aliasedValue(definitions: readonly TSESLint.Scope.Definition[]): TSESTree.Expression | undefined {
  const [definition, ...others] = definitions;

  if (
    definition?.type !== TSESLint.Scope.DefinitionType.Variable ||
    others.length > 0 ||
    definition.parent.kind !== 'const' ||
    definition.node.id.type !== AST_NODE_TYPES.Identifier
  ) {
    return undefined;
  }

  return definition.node.init ?? undefined;
}
