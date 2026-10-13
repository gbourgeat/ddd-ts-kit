import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The name a chain of calls and members starts from: `Money` in `Money.of(1).add(tax)`; undefined when it starts from `this` or an expression. */
export function rootName(node: TSESTree.Node): string | undefined {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier: {
      return node.name;
    }
    case AST_NODE_TYPES.MemberExpression: {
      return rootName(node.object);
    }
    case AST_NODE_TYPES.CallExpression:
    case AST_NODE_TYPES.NewExpression: {
      return rootName(node.callee);
    }
    case AST_NODE_TYPES.ChainExpression: {
      return rootName(node.expression);
    }
    default: {
      return undefined;
    }
  }
}
