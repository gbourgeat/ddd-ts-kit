import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { descendants } from '../descendants.js';

/** The names of the types a piece of syntax refers to: `Options` for `Options`, `Partial<Options>` and `kernel.Options`. */
export function typeNamesIn(node: TSESTree.Node): string[] {
  return [...descendants(node)].flatMap((inner) => {
    if (inner.type === AST_NODE_TYPES.TSTypeReference) {
      return [leftmost(inner.typeName)];
    }

    if (inner.type !== AST_NODE_TYPES.TSClassImplements && inner.type !== AST_NODE_TYPES.TSInterfaceHeritage) {
      return [];
    }

    return inner.expression.type === AST_NODE_TYPES.Identifier ? [inner.expression.name] : [];
  });
}

function leftmost(name: TSESTree.EntityName): string {
  if (name.type === AST_NODE_TYPES.Identifier) {
    return name.name;
  }

  return name.type === AST_NODE_TYPES.TSQualifiedName ? leftmost(name.left) : 'this';
}
