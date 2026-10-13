import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The names a binding target declares: itself, or every name of a destructuring at any depth, defaults and rests included. */
export function patternIdentifiers(target: TSESTree.Node): TSESTree.Identifier[] {
  switch (target.type) {
    case AST_NODE_TYPES.Identifier:
      return [target];
    case AST_NODE_TYPES.AssignmentPattern:
      return patternIdentifiers(target.left);
    case AST_NODE_TYPES.RestElement:
      return patternIdentifiers(target.argument);
    case AST_NODE_TYPES.ArrayPattern:
      return target.elements.flatMap((element) => (element === null ? [] : patternIdentifiers(element)));
    case AST_NODE_TYPES.ObjectPattern:
      return target.properties.flatMap((property) =>
        patternIdentifiers(property.type === AST_NODE_TYPES.Property ? property.value : property),
      );
    case AST_NODE_TYPES.TSParameterProperty:
      return patternIdentifiers(target.parameter);
    default:
      return [];
  }
}
