import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { classHeader } from './class-header';
import { columnLines } from './column-lines';
import { fieldsLine } from './fields-line';
import { personalColumn, type PersonalColumn } from './personal-column';
import { personalNames } from './personal-names';
import { personalRequestOf, type PersonalRequest } from './personal-request-of';
import { rowObject } from './row-object';

type Spelled = keyof PersonalColumn;

/** How an ORM names a column in a declaration (what its erasure reads) and in a row (what a test writes): the SQL name, or the property of the definition. */
interface Spelling {
  readonly declaration: Spelled;
  readonly row: Spelled;
}

const SPELLINGS: Readonly<Record<string, Spelling>> = {
  knex: { declaration: 'column', row: 'column' },
  drizzle: { declaration: 'property', row: 'property' },
  prisma: { declaration: 'column', row: 'property' },
  typeorm: { declaration: 'property', row: 'property' },
};

const SQL_NAMES: Spelling = { declaration: 'column', row: 'column' };

/**
 * `--personal` as the templates read it: whether a declaration is written, how the rows are erased,
 * the columns the storage gains, and for each ORM the names its declaration, its rows and its tests
 * spell. Nothing when the flag is absent.
 */
export function personalVars(scope: Scope): RenderContext {
  const request = personalRequestOf(scope);

  if (request === undefined) {
    return { any: false, retains: false };
  }

  const { orm } = scope.config.stack;
  const names = personalNames(orm, scope.context);
  const spelling = SPELLINGS[orm] ?? SQL_NAMES;

  return {
    any: true,
    erasure: request.erasure,
    row: request.erasure === 'row',
    pseudonymise: request.erasure === 'pseudonymise',
    subjectIsId: request.subject === 'id',
    names: { ...names },
    ...retentionVars(request, spelling),
    header: classHeader(names.adapter, names.base, names.port),
    exportHeader: classHeader(names.exportAdapter, names.exportBase, names.exportPort),
    ...storageVars(request),
    ...spelledVars(request, spelling),
  };
}

/** The columns the generated storage gains, nullable text each: the personal ones, and the subject column when the row is about somebody else. */
function storageVars(request: PersonalRequest): RenderContext {
  const columns = [...request.fields, ...(request.subject === 'id' ? [] : [request.subject])].map(personalColumn);
  const lines = linesOf(columns, request.retention === undefined ? [] : [personalColumn(request.retention.column)]);

  return { ...sqlStorage(lines), ...modelStorage(lines) };
}

type Lines = ReturnType<typeof linesOf>;

/** The lines of a Knex table and row, and of a Drizzle table. */
function sqlStorage(lines: Lines): RenderContext {
  return {
    knexTable: lines(
      ({ column }) => `    table.text('${column}');`,
      ({ column }) => `    table.timestamp('${column}', { useTz: true });`,
    ),
    knexRow: lines(
      ({ column }) => `  readonly ${column}: string | null;`,
      ({ column }) => `  readonly ${column}: Date | null;`,
    ),
    drizzleTable: lines(
      ({ column, property }) => `  ${property}: text('${column}'),`,
      ({ column, property }) => `  ${property}: timestamp('${column}', { withTimezone: true, mode: 'date' }),`,
    ),
    drizzleTenantTable: lines(
      ({ column, property }) => `    ${property}: text('${column}'),`,
      ({ column, property }) => `    ${property}: timestamp('${column}', { withTimezone: true, mode: 'date' }),`,
    ),
  };
}

/** The lines of a Prisma model and of a TypeORM entity and row. */
function modelStorage(lines: Lines): RenderContext {
  return {
    prismaModel: lines(
      ({ column, property }) => `  ${property} String? @map("${column}")`,
      ({ column, property }) => `  ${property} DateTime? @map("${column}") @db.Timestamptz(3)`,
    ),
    typeormTable: lines(
      ({ column, property }) => `    ${property}: { name: '${column}', type: 'text', nullable: true },`,
      ({ column, property }) => `    ${property}: { name: '${column}', type: 'timestamptz', nullable: true },`,
    ),
    typeormRow: lines(
      ({ property }) => `  ${property}: string | null;`,
      ({ property }) => `  ${property}: Date | null;`,
    ),
  };
}

/** The lines of the personal columns, as text, then the date column a retention adds, as a timestamp. */
function linesOf(
  columns: readonly PersonalColumn[],
  dated: readonly PersonalColumn[],
): (text: (column: PersonalColumn) => string, date: (column: PersonalColumn) => string) => string {
  return (text, date) =>
    [columnLines(columns, text), ...(dated.length === 0 ? [] : [columnLines(dated, date)])].join('\n');
}

/** The retention as the declaration spells it and as the generated spec dates a row. */
function retentionVars(request: PersonalRequest, spelling: Spelling): RenderContext {
  const { retention } = request;

  if (retention === undefined) {
    return { retains: false };
  }

  const after = personalColumn(retention.column);

  return {
    retains: true,
    retention: `{ after: '${after[spelling.declaration]}', ${retention.unit}: ${String(retention.amount)} }`,
    retentionRow: after[spelling.row],
    retentionColumn: retention.column,
  };
}

/** The subject and the fields as the declaration of this ORM spells them, the rows of two people as its tests write and expect them, and what the export hands over of one. */
function spelledVars(request: PersonalRequest, spelling: Spelling): RenderContext {
  const fields = request.fields.map(personalColumn);
  const subject = personalColumn(request.subject);
  const dated = request.retention === undefined ? [] : [personalColumn(request.retention.column)];
  const columns = [...(request.subject === 'id' ? fields : [...fields, subject]), ...dated];

  const about = (person: string): (readonly [string, string])[] =>
    request.subject === 'id' ? [] : [[subject[spelling.row], `'${person}'`]];

  return {
    subject: subject[spelling.declaration],
    nullColumns: columnLines(columns, (column) => `      ${column[spelling.row]}: null,`),
    fields: fieldsLine(fields.map((field) => field[spelling.declaration])),
    ofAda: rowObject([
      ...about('ada'),
      ...fields.map((field) => [field[spelling.row], `'${field.column} of ada'`] as const),
    ]),
    ofBob: rowObject([
      ...about('bob'),
      ...fields.map((field) => [field[spelling.row], `'${field.column} of bob'`] as const),
    ]),
    erased: rowObject(fields.map((field) => [field[spelling.row], 'ERASED_PERSONAL_DATA'] as const)),
    exportedOfAda: rowObject(fields.map((field) => [field[spelling.declaration], `'${field.column} of ada'`] as const)),
    exportedErased: rowObject(fields.map((field) => [field[spelling.declaration], 'ERASED_PERSONAL_DATA'] as const)),
  };
}
