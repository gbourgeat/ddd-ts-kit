import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** Constructor parameters declared as properties: `constructor(private readonly id: string)`. */
export function parameterProperties(
  constructor: TSESTree.MethodDefinition | undefined,
): TSESTree.TSParameterProperty[] {
  return constructor?.value.params.filter((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty) ?? [];
}
