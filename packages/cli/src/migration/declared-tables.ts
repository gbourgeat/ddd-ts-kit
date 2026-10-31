import { scan } from '../check/scan/scan';
import { stringAt } from '../check/scan/string-at';

/** A table a file exports: the constant, and the name of the table in the database. */
export interface DeclaredTable {
  readonly constant: string;
  readonly table: string;
}

const DRIZZLE = /^export const (\w+) = \w+\.table\(\s*/gm;
const TYPEORM = /^export const (\w+) = new EntitySchema\b[\s\S]*?\btableName:\s*/gm;

/** The tables a file exports, a Drizzle `.table('orders', ...)` or a TypeORM `tableName: 'orders'`, comments left out. */
export function declaredTables(source: string): DeclaredTable[] {
  const { code } = scan(source);

  return [DRIZZLE, TYPEORM].flatMap((declaration) =>
    [...code.matchAll(declaration)].flatMap((found) => {
      const table = stringAt(source, found.index + found[0].length);

      return table === undefined ? [] : [{ constant: found[1] ?? '', table }];
    }),
  );
}
