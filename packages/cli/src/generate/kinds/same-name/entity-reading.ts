import { type Bound, boundBy, type EntityOf } from './bound-by';
import { entryOf } from './entry-of';
import { regionOf } from './region-of';

/** The regions of a TypeORM schema index as a settle reads them: the imports, and the names `entities` lists. */
export interface EntityReading {
  readonly bound: readonly Bound[];
  /** Each entry of the region of the entities, once per line it is written on. */
  readonly listed: readonly string[];
}

/** The imports of the region of the imports, each by the entity it binds, and the entries of the region of the entities. */
export function entityReading(index: string, entityOf: EntityOf): EntityReading {
  const listed = regionOf(index, 'schemas')
    .split('\n')
    .flatMap((line) => entryOf(line) ?? []);

  return { bound: boundBy(regionOf(index, 'imports'), entityOf), listed };
}
