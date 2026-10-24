import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** How an expression of a template title is read: as the placeholder of a table-driven title. */
const PLACEHOLDER = '$value';

/**
 * The text of a title: a string literal, or a template whose expressions read as placeholders, the way
 * `it.each` fills `%s` and `$name`. Nothing for a title held in a variable, which is not judged.
 */
export function titleText(node: TSESTree.CallExpressionArgument | undefined): string | undefined {
  if (node === undefined) {
    return undefined;
  }

  if (node.type === AST_NODE_TYPES.Literal) {
    return typeof node.value === 'string' ? node.value : undefined;
  }

  if (node.type !== AST_NODE_TYPES.TemplateLiteral) {
    return undefined;
  }

  return node.quasis
    .map((quasi, index) => (quasi.value.cooked ?? '') + (index < node.expressions.length ? PLACEHOLDER : ''))
    .join('');
}
