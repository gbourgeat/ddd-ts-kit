import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);

/**
 * The name under which `node` reaches something ambient: a global or an import binding
 * (`crypto`), also through the global object (`globalThis.crypto`). Undefined when the name
 * is a local declaration that merely shadows the global.
 */
export function ambientName(sourceCode: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return isAmbient(sourceCode, node) ? node.name : undefined;
  if (node.type !== AST_NODE_TYPES.MemberExpression || node.object.type !== AST_NODE_TYPES.Identifier) return undefined;
  if (!GLOBAL_OBJECTS.has(node.object.name) || !isAmbient(sourceCode, node.object)) return undefined;
  return propertyName(node);
}

export function propertyName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed) return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
  return node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string' ? node.property.value : undefined;
}

function isAmbient(sourceCode: Readonly<TSESLint.SourceCode>, identifier: TSESTree.Identifier): boolean {
  const variable = ASTUtils.findVariable(sourceCode.getScope(identifier), identifier.name);
  return variable === null || variable.defs.every((definition) => definition.type === TSESLint.Scope.DefinitionType.ImportBinding);
}
