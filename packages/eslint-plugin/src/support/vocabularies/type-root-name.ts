import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/**
 * The name a type written as one reference starts from: `Payload` for `Payload['state']`,
 * `typeof x`, `keyof typeof x`, `ns.Name`, `Name<..>` or `(typeof x)[..]`. Nothing for a union,
 * an intersection, an array, a literal or an object type, which are not one reference.
 */
export function typeRootName(type: TSESTree.TypeNode): string | undefined {
  switch (type.type) {
    case AST_NODE_TYPES.TSTypeReference:
      return leftmost(type.typeName);
    case AST_NODE_TYPES.TSIndexedAccessType:
      return typeRootName(type.objectType);
    case AST_NODE_TYPES.TSTypeQuery:
      return type.exprName.type === AST_NODE_TYPES.TSImportType ? undefined : leftmost(type.exprName);
    case AST_NODE_TYPES.TSTypeOperator:
      return type.operator === 'keyof' && type.typeAnnotation !== undefined
        ? typeRootName(type.typeAnnotation)
        : undefined;
    default:
      return undefined;
  }
}

function leftmost(name: TSESTree.EntityName): string | undefined {
  if (name.type === AST_NODE_TYPES.Identifier) {
    return name.name;
  }

  return name.type === AST_NODE_TYPES.TSQualifiedName ? leftmost(name.left) : undefined;
}
