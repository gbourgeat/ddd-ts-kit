import type { PrismaPersonalFields } from './prisma-personal-fields';
import { quoted } from './quoted';

/** The table of a declaration, in its schema, quoted. */
export function pathOf({ table }: PrismaPersonalFields): string {
  return table.schema === undefined ? quoted(table.table) : `${quoted(table.schema)}.${quoted(table.table)}`;
}
