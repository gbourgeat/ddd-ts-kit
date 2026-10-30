import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file';
import type { FunctionNode } from '../functions/function-node';
import { importedBindings } from '../ports/imported-bindings';

/**
 * Whether a function declares that it returns a type of a package (`): EventStamp` of the kernel):
 * the shape is the one of the library, which the project cannot make a class of its own.
 */
export function returnsPackageType(file: LintedFile, program: TSESTree.Program, node: FunctionNode): boolean {
  const annotation = node.returnType?.typeAnnotation;

  if (annotation?.type !== AST_NODE_TYPES.TSTypeReference) {
    return false;
  }

  const name = leftmost(annotation.typeName);

  return importedBindings(file, program).get(name)?.target.kind === 'package';
}

function leftmost(name: TSESTree.EntityName): string {
  if (name.type === AST_NODE_TYPES.TSQualifiedName) {
    return leftmost(name.left);
  }

  // `this` stands in an entity name only under `typeof`, never in a type reference.
  return name.type === AST_NODE_TYPES.Identifier ? name.name : '';
}
