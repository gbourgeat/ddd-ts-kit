import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file';
import type { ClassNode } from '../classes/class-name';
import { topLevelClasses } from '../classes/top-level-classes';
import { importedBindings } from '../ports/imported-bindings';
import { isValueObjectPath } from './is-value-object-path';

/**
 * Whether a class is a value object: it extends `ValueObject` of the kernel, a class of its own
 * module that does, or a class imported from a value object file of the project, whose own file
 * is judged on its own.
 */
export function extendsValueObject(file: LintedFile, program: TSESTree.Program, node: ClassNode): boolean {
  const imported = importedBindings(file, program);
  const seen = new Set<ClassNode>();
  let current: ClassNode | undefined = node;

  while (current !== undefined && !seen.has(current)) {
    const parent = parentName(current.superClass);
    const target = parent === undefined ? undefined : imported.get(parent)?.target;

    if (parent === 'ValueObject') {
      return true;
    }

    if (target?.kind === 'file') {
      return isValueObjectPath(target.path, target.location, file.config.sharedKernelDir);
    }

    seen.add(current);
    current = topLevelClasses(program).find((candidate) => parent !== undefined && candidate.id?.name === parent);
  }

  return false;
}

function parentName(superClass: TSESTree.LeftHandSideExpression | null): string | undefined {
  if (superClass?.type === AST_NODE_TYPES.Identifier) {
    return superClass.name;
  }

  return superClass?.type === AST_NODE_TYPES.MemberExpression && superClass.property.type === AST_NODE_TYPES.Identifier
    ? superClass.property.name
    : undefined;
}
