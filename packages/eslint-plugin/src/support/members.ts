import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** True for `this.x`, `this.a.b`, `this.#x`: an access that starts at the instance. */
export function startsAtThis(node: TSESTree.Node): boolean {
  let current = node;
  while (current.type === AST_NODE_TYPES.MemberExpression) current = current.object;
  return current.type === AST_NODE_TYPES.ThisExpression && node.type === AST_NODE_TYPES.MemberExpression;
}

/** Constructor parameters declared as properties: `constructor(private readonly id: string)`. */
export function parameterProperties(constructor: TSESTree.MethodDefinition | undefined): TSESTree.TSParameterProperty[] {
  return constructor?.value.params.filter((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty) ?? [];
}

export function parameterName(property: TSESTree.TSParameterProperty): string {
  const { parameter } = property;
  const target = parameter.type === AST_NODE_TYPES.AssignmentPattern ? parameter.left : parameter;
  return target.name;
}
