import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The binding a parameter declares, behind `private readonly` and a default value. */
export function parameterBinding(parameter: TSESTree.Parameter): TSESTree.BindingName | TSESTree.RestElement {
  const declared = parameter.type === AST_NODE_TYPES.TSParameterProperty ? parameter.parameter : parameter;

  return declared.type === AST_NODE_TYPES.AssignmentPattern ? declared.left : declared;
}
