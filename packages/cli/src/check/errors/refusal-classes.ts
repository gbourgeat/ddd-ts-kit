import type { Scan } from '../scan/scan.js';
import { readStructure } from '../structure/read-structure.js';
import type { ClassShape } from '../structure/class-shape.js';

/**
 * The classes of a source that are one refusal each: they extend `DomainRefusal` of the kernel,
 * directly, and are not abstract. An abstract base sets no code of its own.
 */
export function refusalClasses(scan: Scan): ClassShape[] {
  return readStructure(scan).classes.filter(
    (shape) => !shape.isAbstract && /(?:^|\.)DomainRefusal$/.test(shape.superclass ?? ''),
  );
}
