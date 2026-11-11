import { scan } from '../../../check/scan/scan';
import { matchingBracket } from '../../../check/text/matching-bracket';
import { prismaBlocks } from '../../../prisma-schema';
import type { PersonalColumn } from './personal-column';
import type { SchemaTable } from './schema-table';

type Reader = (text: string) => SchemaTable[];

/**
 * The tables the schema file of a context declares, read from its text as each ORM writes them: a
 * Drizzle table (`export const x = schema.table('x', { ... })`), a TypeORM entity schema
 * (`tableName: 'x'`), a table of a Knex schema (`createTable('x', ...)`), a Prisma model
 * (`@@map("x")`). A definition in a comment is not one.
 */
export function schemaTablesOf(orm: string, text: string): SchemaTable[] {
  return READERS[orm]?.(text) ?? [];
}

const READERS: Readonly<Record<string, Reader>> = {
  drizzle: (text) => definitionsIn(text, DRIZZLE_TABLE).map(drizzleTable),
  typeorm: (text) => definitionsIn(text, ENTITY_SCHEMA).flatMap(typeormTable),
  knex: (text) => definitionsIn(text, KNEX_TABLE).map(knexTable),
  prisma: prismaTables,
};

const DRIZZLE_TABLE = /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*[\w$.]*[tT]able\s*\(\s*['"]([^'"]+)['"]/g;
const ENTITY_SCHEMA = /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+EntitySchema\b[^(]*\(/g;
const KNEX_TABLE = /\.createTable\s*\(\s*['"]([^'"]+)['"]/g;

/** One definition of the file: what its pattern captured, and its text from the parenthesis it opens to the one that closes it. */
interface Definition {
  readonly captured: readonly string[];
  readonly body: string;
}

function definitionsIn(text: string, pattern: RegExp): Definition[] {
  const { code } = scan(text);

  return [...text.matchAll(pattern)]
    .filter((match) => code.charAt(match.index) === text.charAt(match.index))
    .map((match) => {
      const open = match.index + match[0].indexOf('(');

      return { captured: match.slice(1), body: text.slice(open, matchingBracket(code, open) + 1) };
    });
}

/** `customerEmail: text('customer_email')`, or `email: text()`, which names the column after its key. */
const DRIZZLE_COLUMN = /\b([A-Za-z_$][\w$]*)\s*:\s*[\w$.]+\(\s*(?:['"]([^'"]+)['"])?/g;
const SPREAD = /\.\.\./;

function drizzleTable({ captured: [reference = '', name = ''], body }: Definition): SchemaTable {
  const columns = [...body.matchAll(DRIZZLE_COLUMN)].flatMap(([, property = '', column]) =>
    column === undefined ? unnamed(property) : [{ column, property }],
  );

  return { name, reference, columns, open: SPREAD.test(body) };
}

/** A column the definition does not name: its key, and its key in snake case, as the `casing` of the client may spell it. */
function unnamed(property: string): PersonalColumn[] {
  const snake = property.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

  return [...new Set([property, snake])].map((column) => ({ column, property }));
}

/** `customerEmail: { name: 'customer_email', type: 'text' }`, or `email: { type: 'text' }`. */
const TYPEORM_COLUMN = /\b([A-Za-z_$][\w$]*)\s*:\s*\{([^{}]*\btype:[^{}]*)\}/g;

function typeormTable({ captured: [reference = ''], body }: Definition): SchemaTable[] {
  const name = /\btableName:\s*['"]([^'"]+)['"]/.exec(body)?.[1];

  const columns = [...body.matchAll(TYPEORM_COLUMN)].map(([, property = '', options = '']) => ({
    column: /\bname:\s*['"]([^'"]+)['"]/.exec(options)?.[1] ?? property,
    property,
  }));

  return name === undefined ? [] : [{ name, reference, columns, open: SPREAD.test(body) }];
}

/** `table.text('customer_email')`. */
const KNEX_COLUMN = /\b[\w$]+\.[\w$]+\(\s*['"]([A-Za-z_]\w*)['"]/g;
/** `auditColumns(table)`: a helper that adds columns of its own. */
const KNEX_HELPER = /(?<![.\w$])[\w$]+\(\s*[\w$]+\s*[,)]/;

function knexTable({ captured: [name = ''], body }: Definition): SchemaTable {
  const columns = [...body.matchAll(KNEX_COLUMN)].map(([, column = '']) => ({ column, property: column }));

  return { name, reference: name, columns, open: KNEX_HELPER.test(body) };
}

const PRISMA_MODEL = /^model\s+(\w+)\s*\{/;
const PRISMA_FIELD = /^\s+([A-Za-z_]\w*)\s+[A-Z]\w*(?:\[\]|\?)?(.*)$/;

function prismaTables(text: string): SchemaTable[] {
  const lines = text.split('\n');

  return prismaBlocks(lines).flatMap(({ start, end }) => {
    const model = PRISMA_MODEL.exec(lines[start] ?? '')?.[1];
    const body = lines.slice(start + 1, end);
    const mapped = body.flatMap((line) => /@@map\("([^"]+)"\)/.exec(line)?.[1] ?? [])[0];

    return model === undefined
      ? []
      : [{ name: mapped ?? model, reference: model, columns: body.flatMap(prismaColumn), open: false }];
  });
}

function prismaColumn(line: string): PersonalColumn[] {
  const [, property, rest = ''] = PRISMA_FIELD.exec(line) ?? [];

  return property === undefined ? [] : [{ column: /@map\("([^"]+)"\)/.exec(rest)?.[1] ?? property, property }];
}
