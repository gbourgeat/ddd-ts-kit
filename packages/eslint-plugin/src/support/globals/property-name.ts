import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function propertyName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed) {
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
  }

  return node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string'
    ? node.property.value
    : undefined;
}
