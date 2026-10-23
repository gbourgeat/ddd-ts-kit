import type { SourceFile } from '../model/source-file';
import type { ClassShape } from '../structure/class-shape';

const BASE = 'EventSourcedAggregate';

/** The classes of a production file of `domain/aggregates/` that extend `EventSourcedAggregate` of the kernel. */
export function eventSourcedClasses(file: SourceFile): readonly ClassShape[] {
  const { location } = file;

  if (
    location.area !== 'context' ||
    file.isTest ||
    location.layer !== 'domain' ||
    location.inside[0] !== 'aggregates'
  ) {
    return [];
  }

  return file.structure.classes.filter((shape) => shape.superclass === BASE);
}
