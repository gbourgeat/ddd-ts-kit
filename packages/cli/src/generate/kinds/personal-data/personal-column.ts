import { propertyOf } from './property-of';

/** One column the declaration names: as the database spells it, and as the definition of the table spells it. */
export interface PersonalColumn {
  readonly column: string;
  readonly property: string;
}

export function personalColumn(column: string): PersonalColumn {
  return { column, property: propertyOf(column) };
}
