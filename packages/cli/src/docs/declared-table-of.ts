import { scan } from '../check/scan/scan';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import { matchingBracket } from '../check/text/matching-bracket';

/** The table a declaration names, and the column each name of the declaration stands for. */
export interface DeclaredTable {
  readonly name: string;
  /** A property of a Drizzle table or a TypeORM entity as the database names it; any other name as written. */
  column(name: string): string;
}

/**
 * The table of a `personalFields` call, from what its first argument says: `{ table: 'customers' }`
 * written in the call or in the constant it names (Knex, Prisma), or the Drizzle table or the
 * TypeORM entity schema a persistence file of the context defines under that name, whose
 * properties are then read back as the columns they map.
 */
export function declaredTableOf(written: string, declaration: string, sources: string): DeclaredTable {
  const inline = /\btable:\s*['"]([^'"]+)['"]/.exec(written)?.[1];
  const asWritten = (name: string): string => name;

  if (inline !== undefined || !/^[\w$]+$/.test(written)) {
    return { name: inline ?? written, column: asWritten };
  }

  const constant = new RegExp(
    String.raw`\bconst\s+${escapeRegExp(written)}\b[^=]*=\s*\{[^}]*\btable:\s*['"]([^'"]+)['"]`,
  ).exec(declaration)?.[1];

  return constant === undefined
    ? (definedTable(sources, written) ?? { name: written, column: asWritten })
    : { name: constant, column: asWritten };
}

/** `const customers = schema.table('customers', { ... })` or `const customers = new EntitySchema({ tableName: 'customers', ... })`. */
function definedTable(sources: string, constant: string): DeclaredTable | undefined {
  const definition = new RegExp(
    String.raw`\bconst\s+${escapeRegExp(constant)}\s*=\s*(new\s+EntitySchema\b)?[^(]*\(`,
  ).exec(sources);

  if (definition === null) {
    return undefined;
  }

  const open = definition.index + definition[0].length - 1;
  const body = sources.slice(open, matchingBracket(scan(sources).code, open) + 1);

  const name = (definition[1] === undefined ? /^\(\s*['"]([^'"]+)['"]/ : /\btableName:\s*['"]([^'"]+)['"]/).exec(
    body,
  )?.[1];

  return name === undefined ? undefined : { name, column: (property) => columnOf(body, property) };
}

/** `customerEmail: text('customer_email')` on Drizzle, `customerEmail: { name: 'customer_email', ... }` on TypeORM. */
function columnOf(body: string, property: string): string {
  const key = escapeRegExp(property);
  const drizzle = new RegExp(String.raw`\b${key}\s*:\s*[\w$]+\(\s*['"]([^'"]+)['"]`).exec(body)?.[1];
  const typeorm = new RegExp(String.raw`\b${key}\s*:\s*\{[^}]*\bname:\s*['"]([^'"]+)['"]`).exec(body)?.[1];

  return drizzle ?? typeorm ?? property;
}
