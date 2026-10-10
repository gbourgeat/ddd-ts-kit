import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { propertyName } from '../globals/property-name.js';

/** The name a call is made under: `resolve` for `resolve(x)`, `bind` for `builder.bind(x)`. */
export function calleeName(node: TSESTree.CallExpression | TSESTree.NewExpression): string | undefined {
  const { callee } = node;

  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name;
  }

  return callee.type === AST_NODE_TYPES.MemberExpression ? propertyName(callee) : undefined;
}
