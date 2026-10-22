import type { SourceFile } from '../model/source-file';
import type { ClassShape } from '../structure/class-shape';
import { importedFrom } from '../support/imported-from';
import { isValueObjectFile } from './is-value-object-file';

/**
 * Whether a class is a value object: it extends `ValueObject` of the kernel, a class of its own
 * file that does, or a class imported from a value object file of the project, whose own file is
 * judged on its own.
 */
export function extendsValueObject(file: SourceFile, shape: ClassShape, sharedKernelDir: string): boolean {
  const seen = new Set<string>();
  let current: ClassShape | undefined = shape;

  while (current?.superclass !== undefined && !seen.has(current.name)) {
    const parent: string = current.superclass;

    if (parent === 'ValueObject' || parent.endsWith('.ValueObject')) {
      return true;
    }

    const target = importedFrom(file, parent)?.target;

    if (target?.kind === 'file') {
      return isValueObjectFile(target.path, target.location, sharedKernelDir);
    }

    seen.add(current.name);
    current = file.structure.classes.find(({ name, depth }) => name === parent && depth === 0);
  }

  return false;
}
