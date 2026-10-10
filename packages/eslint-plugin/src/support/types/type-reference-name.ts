import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** The name a declaration is typed with: `Access` for `: Access`, `ActorContext` for `: kernel.ActorContext`. */
export function typeReferenceName(annotation: TSESTree.TSTypeAnnotation | undefined): string | undefined {
  const type = annotation?.typeAnnotation;

  if (type?.type !== AST_NODE_TYPES.TSTypeReference) return undefined;

  const { typeName } = type;

  if (typeName.type === AST_NODE_TYPES.Identifier) return typeName.name;

  return typeName.type === AST_NODE_TYPES.TSQualifiedName ? typeName.right.name : undefined;
}
