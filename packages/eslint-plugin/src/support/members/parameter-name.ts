import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function parameterName(property: TSESTree.TSParameterProperty): string {
  const { parameter } = property;
  const target = parameter.type === AST_NODE_TYPES.AssignmentPattern ? parameter.left : parameter;

  return target.name;
}
