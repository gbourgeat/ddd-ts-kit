import type { RenderContext } from '../../../templating';
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

/** Where the fields are written in the Drizzle table: the constant of the table, and the indentation of its columns. */
export interface DrizzleTable {
  readonly constant: string;
  /** Deeper once the table takes the index of its tenant. */
  readonly indent: string;
}

/**
 * The fields of the row of a read model as its templates read them: the lines of the row, of its
 * criteria and of a sample row, then the columns and the mapping of each ORM.
 */
export function fieldLines(fields: readonly ReadModelField[], table: DrizzleTable): RenderContext {
  const lines = (line: (field: ReadModelField, spelling: Spelling) => string): string =>
    fields.map((field) => line(field, SPELLINGS[field.type])).join('\n');

  return {
    any: fields.length > 0,
    row: lines((field, { row }) => `  readonly ${field.name}: ${row}${field.nullable ? ' | null' : ''};`),
    criteria: lines(criteriaField),
    sample: lines((field, { sample }) => `    ${field.name}: ${sample(field)},`),
    names: lines(({ name, column }) => `        ${name}: '${column}',`),
    drizzleImports: [...new Set(['text', ...fields.map(({ type }) => SPELLINGS[type].drizzle[0])])].join(', '),
    drizzleTable: lines((field, spelling) => `${table.indent}${drizzleColumn(field, spelling)}`),
    drizzleColumns: lines(({ name }) => `        ${name}: ${table.constant}.${name},`),
    knexTable: lines(({ column, nullable }, { knex }) => `    ${knex(column)}${nullable ? '' : '.notNullable()'};`),
    prismaModel: lines(prismaField),
    typeormTable: lines(typeormColumn),
  };
}

function criteriaField({ name, type, nullable }: ReadModelField): string {
  return `    ${name}: { type: '${type}'${nullable ? ', nullable: true' : ''} },`;
}

function drizzleColumn({ name, column, nullable }: ReadModelField, { drizzle }: Spelling): string {
  const [declare, options] = drizzle;

  return `${name}: ${declare}('${column}'${options})${nullable ? '' : '.notNull()'},`;
}

function prismaField({ name, column, type, nullable }: ReadModelField, { prisma }: Spelling): string {
  const mapped = name === column ? '' : ` @map("${column}")`;

  return `  ${name} ${prisma}${nullable ? '?' : ''}${mapped}${type === 'instant' ? ' @db.Timestamptz(3)' : ''}`;
}

function typeormColumn({ name, column, nullable }: ReadModelField, { typeorm }: Spelling): string {
  const named = name === column ? '' : `name: '${column}', `;

  return `    ${name}: { ${named}${typeorm}${nullable ? ', nullable: true' : ''} },`;
}
