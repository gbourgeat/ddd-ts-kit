import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The name a constructor parameter is written under, or its source shape when it has none. */
export function writtenName(node: TSESTree.Parameter): string {
  const parameter = node.type === AST_NODE_TYPES.TSParameterProperty ? node.parameter : node;
  const target = parameter.type === AST_NODE_TYPES.AssignmentPattern ? parameter.left : parameter;

  if (target.type === AST_NODE_TYPES.Identifier) {
    return target.name;
  }

  return target.type === AST_NODE_TYPES.RestElement && target.argument.type === AST_NODE_TYPES.Identifier
    ? target.argument.name
    : 'the destructured one';
}
