import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function staticString(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal) return typeof node.value === 'string' ? node.value : undefined;
  if (node.type !== AST_NODE_TYPES.TemplateLiteral || node.expressions.length > 0) return undefined;

  return node.quasis[0]?.value.cooked ?? undefined;
}
