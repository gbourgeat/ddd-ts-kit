import { LINE_WIDTH } from '../../../layout';
import type { ReadModelTable } from './read-model-table';
import type { ReadModelField } from './read-model-fields';

/** The check constraint of a read model table, as the templates of each ORM read it. */
export interface LiveRowsCheck {
  readonly [key: string]: string | boolean;
  /** False when the row requires no field: the table then takes no constraint. */
  readonly checked: boolean;
  /** The Drizzle table takes a third argument: the index of its tenant, the constraint, or both. */
  readonly drizzleWide: boolean;
  readonly drizzleExtras: string;
  readonly knexCheck: string;
  readonly typeormCheck: string;
  readonly prismaCheck: string;
}

/**
 * The columns of a read model table accept null, so that a removed row can be a trace without its
 * fields; this constraint keeps every other row whole: `deleted or (<column> is not null and ...)`
 * over the fields the row requires. Drizzle, Knex and TypeORM declare it with the table. The schema
 * language of Prisma has no check constraint: its statement is left to add to the migration.
 */
export function liveRowsCheck(fields: readonly ReadModelField[], table: ReadModelTable): LiveRowsCheck {
  const required = fields.filter((field) => !field.nullable);
  const name = `${table.name}_live_rows_whole`;

  const whole = (column: (field: ReadModelField) => string): string =>
    `(${required.map((field) => `${column(field)} is not null`).join(' and ')})`;

  const checked = required.length > 0;
  const quoted = whole(({ column }) => `"${column}"`);
  const drizzle = `check('${name}', sql\`\${table.deleted} or ${whole((field) => `\${table.${field.name}}`)}\`)`;
  const tenantIndex = `index('${table.name}_tenant_idx').on(table.tenantId, table.id)`;
  const extras = [...(table.tenantScoped ? [tenantIndex] : []), ...(checked ? [drizzle] : [])];

  return {
    checked,
    drizzleWide: extras.length > 0,
    drizzleExtras: fittedCall('  ', ['(table) => [', '],'], extras),
    knexCheck: apart(
      fittedCall('    ', ['table.check(', ');'], [`'deleted or ${whole(({ column }) => column)}'`, '{}', `'${name}'`]),
    ),
    typeormCheck: `      name: '${name}',\n      expression: '"deleted" or ${quoted}',`,
    prismaCheck: `ALTER TABLE "${table.schema}"."${table.name}" ADD CONSTRAINT "${name}" CHECK ("deleted" OR ${quoted.replaceAll(' is not null', ' IS NOT NULL').replaceAll(' and ', ' AND ')});`,
  };
}

/** A statement that takes several lines is set apart from the one above it, as the layout rules of a generated project ask. */
function apart(statement: string): string {
  return statement.includes('\n') ? `\n${statement}` : statement;
}

/**
 * A call or a list as the formatter of a generated project prints it: on one line when it fits the
 * width, else each item on a line of its own, an item that is itself a call too long broken the same way.
 */
function fittedCall(indent: string, [open, close]: readonly [string, string], items: readonly string[]): string {
  const line = `${indent}${open}${items.join(', ')}${close}`;

  if (line.length <= LINE_WIDTH) {
    return line;
  }

  const inner = `${indent}  `;

  const broken = items.map((item) => {
    const [, called = '', passed = ''] = /^(\w+\()(.*)\)$/s.exec(item) ?? [];
    const fits = `${inner}${item},`.length <= LINE_WIDTH || called === '';

    return fits ? `${inner}${item},` : fittedCall(inner, [called, '),'], passed.split(/, (?=sql`)/));
  });

  return [`${indent}${open}`, ...broken, `${indent}${close}`].join('\n');
}
