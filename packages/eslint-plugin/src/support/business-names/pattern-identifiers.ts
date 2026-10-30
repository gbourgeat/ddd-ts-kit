import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The names a binding target declares: itself, or every name of a destructuring at any depth, defaults and rests included. */
export function patternIdentifiers(target: TSESTree.Node): TSESTree.Identifier[] {
  if (target.type === AST_NODE_TYPES.Identifier) {
    return [target];
  }

  if (target.type === AST_NODE_TYPES.AssignmentPattern) {
    return patternIdentifiers(target.left);
  }

  if (target.type === AST_NODE_TYPES.RestElement) {
    return patternIdentifiers(target.argument);
  }

  if (target.type === AST_NODE_TYPES.ArrayPattern) {
    return target.elements.flatMap((element) => (element === null ? [] : patternIdentifiers(element)));
  }

  if (target.type === AST_NODE_TYPES.ObjectPattern) {
    return target.properties.flatMap((property) =>
      patternIdentifiers(property.type === AST_NODE_TYPES.Property ? property.value : property),
    );
  }

  // A member expression stands in a pattern only as an assignment target, never in a declaration.
  return target.type === AST_NODE_TYPES.TSParameterProperty ? patternIdentifiers(target.parameter) : [];
}
