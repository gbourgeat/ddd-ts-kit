import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file.js';
import type { FunctionNode } from '../functions/function-node.js';
import { importedBindings } from '../ports/imported-bindings.js';

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
  switch (name.type) {
    case AST_NODE_TYPES.Identifier: {
      return name.name;
    }
    case AST_NODE_TYPES.TSQualifiedName: {
      return leftmost(name.left);
    }
    default: {
      return '';
    }
  }
}
