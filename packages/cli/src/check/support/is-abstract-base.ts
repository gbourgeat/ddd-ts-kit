import type { SourceFile } from '../model/source-file.js';

/**
 * True when every class the file exports is abstract and it exports no function: a polymorphic
 * base (a strategy of the domain) whose behaviour is held by the specs of its implementations.
 */
export function isAbstractBase(file: SourceFile): boolean {
  const exported = file.structure.classes.filter((shape) => shape.depth === 0 && shape.isExported);

  return (
    exported.length > 0 &&
    exported.every((shape) => shape.isAbstract) &&
    !file.structure.functions.some((shape) => shape.exported)
  );
}
