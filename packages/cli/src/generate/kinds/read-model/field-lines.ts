import type { RenderContext } from '../../../templating';
import { liveRowsCheck } from './live-rows-check';
import type { FieldType, ReadModelField } from './read-model-fields';

/** How each type of field is written: in the row, in a sample of it, and in the table of each ORM. */
interface Spelling {
  readonly row: string;
  readonly sample: (field: ReadModelField) => string;
  /** The function of `drizzle-orm/pg-core` that declares the column, and what it takes after the name. */
  readonly drizzle: readonly [name: string, options: string];
  readonly knex: (column: string) => string;
  readonly prisma: string;
  readonly typeorm: string;
}

const SPELLINGS: Readonly<Record<FieldType, Spelling>> = {
  string: {
    row: 'string',
    sample: ({ name }) => `\`${name} of \${key}\``,
    drizzle: ['text', ''],
    knex: (column) => `table.text('${column}')`,
    prisma: 'String',
    typeorm: "type: 'text'",
  },
  number: {
    row: 'number',
    sample: () => '1',
    drizzle: ['doublePrecision', ''],
    knex: (column) => `table.double('${column}')`,
    prisma: 'Float',
    typeorm: "type: 'double precision'",
  },
  boolean: {
    row: 'boolean',
    sample: () => 'true',
    drizzle: ['boolean', ''],
    knex: (column) => `table.boolean('${column}')`,
    prisma: 'Boolean',
    typeorm: "type: 'boolean'",
  },
  instant: {
    row: 'Date',
    sample: () => "new Date('2026-01-01T00:00:00.000Z')",
    drizzle: ['timestamp', ", { withTimezone: true, mode: 'date' }"],
    knex: (column) => `table.datetime('${column}', { useTz: true, precision: 3 })`,
    prisma: 'DateTime',
    typeorm: "type: 'timestamp with time zone', precision: 3",
  },
  decimal: {
    row: 'string',
    sample: () => "'12.5'",
    drizzle: ['numeric', ''],
    knex: (column) => `table.specificType('${column}', 'numeric')`,
    prisma: 'Decimal',
    typeorm: "type: 'numeric'",
  },
};

/** The table the fields are written in. */
export interface ReadModelTable {
  /** Its name in the database, and the start of the name of what it declares. */
  readonly name: string;
  /** The constant of the Drizzle table and of the TypeORM entity. */
  readonly constant: string;
  /** The database schema of its context. */
  readonly schema: string;
  readonly tenantScoped: boolean;
}

/**
 * The fields of the row of a read model as its templates read them: the lines of the row, of its
 * criteria and of a sample row, then the columns and the mapping of each ORM. Every column of a
 * field accepts null, whatever the row requires: a removed row is a trace that holds its key and
 * its stamp alone, and `liveRowsCheck` is what keeps the rows that are not removed whole.
 */
export function fieldLines(fields: readonly ReadModelField[], table: ReadModelTable): RenderContext {
  const lines = (line: (field: ReadModelField, spelling: Spelling) => string): string =>
    fields.map((field) => line(field, SPELLINGS[field.type])).join('\n');

  const check = liveRowsCheck(fields, table);
  const indent = check.drizzleWide ? '    ' : '  ';

  return {
    any: fields.length > 0,
    row: lines((field, { row }) => `  readonly ${field.name}: ${row}${field.nullable ? ' | null' : ''};`),
    criteria: lines(criteriaField),
    sample: lines((field, { sample }) => `    ${field.name}: ${sample(field)},`),
    names: lines(({ name, column }) => `        ${name}: '${column}',`),
    drizzleImports: drizzleImports(fields, check.checked),
    drizzleTable: lines(
      ({ name, column }, { drizzle }) => `${indent}${name}: ${drizzle[0]}('${column}'${drizzle[1]}),`,
    ),
    drizzleColumns: lines(({ name }) => `        ${name}: ${table.constant}.${name},`),
    knexTable: lines(({ column }, { knex }) => `    ${knex(column)};`),
    prismaModel: lines(prismaField),
    typeormTable: lines(typeormColumn),
    ...check,
  };
}

/** What the Drizzle table takes from `drizzle-orm/pg-core`: the column of each type it holds, the index of a tenant and the check of its live rows. */
function drizzleImports(fields: readonly ReadModelField[], checked: boolean): string {
  const columns = fields.map(({ type }) => SPELLINGS[type].drizzle[0]);

  return [...new Set([...(checked ? ['check'] : []), 'text', ...columns])].join(', ');
}

function criteriaField({ name, type, nullable }: ReadModelField): string {
  return `    ${name}: { type: '${type}'${nullable ? ', nullable: true' : ''} },`;
}

function prismaField({ name, column, type }: ReadModelField, { prisma }: Spelling): string {
  const mapped = name === column ? '' : ` @map("${column}")`;

  return `  ${name} ${prisma}?${mapped}${type === 'instant' ? ' @db.Timestamptz(3)' : ''}`;
}

function typeormColumn({ name, column }: ReadModelField, { typeorm }: Spelling): string {
  const named = name === column ? '' : `name: '${column}', `;

  return `    ${name}: { ${named}${typeorm}, nullable: true },`;
}
