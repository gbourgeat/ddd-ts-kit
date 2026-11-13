import type { SourceFile } from '../check/model/source-file';
import type { DeclaredClass } from './declared-class';

/** Every class the sources declare at the level of a module, several in one file included; the tests are not read. */
export function declaredClassesOf(files: readonly SourceFile[]): DeclaredClass[] {
  return files
    .filter((file) => !file.isTest)
    .flatMap((file) =>
      file.structure.classes
        .filter((shape) => shape.depth === 0)
        .map((shape) => ({
          file: file.path,
          context: file.location.area === 'context' ? file.location.context : undefined,
          shape,
          code: file.scan.code.slice(shape.start, shape.end + 1),
        })),
    );
}
