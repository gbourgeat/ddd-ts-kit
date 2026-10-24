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
    return { any: false };
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
    header: classHeader(names.adapter, names.base, names.port),
    ...storageVars(request),
    ...spelledVars(request, spelling),
  };
}

/** The columns the generated storage gains, nullable text each: the personal ones, and the subject column when the row is about somebody else. */
function storageVars(request: PersonalRequest): RenderContext {
  const columns = [...request.fields, ...(request.subject === 'id' ? [] : [request.subject])].map(personalColumn);

  return {
    knexTable: columnLines(columns, ({ column }) => `    table.text('${column}');`),
    knexRow: columnLines(columns, ({ column }) => `  readonly ${column}: string | null;`),
    drizzleTable: columnLines(columns, ({ column, property }) => `  ${property}: text('${column}'),`),
    drizzleTenantTable: columnLines(columns, ({ column, property }) => `    ${property}: text('${column}'),`),
    prismaModel: columnLines(columns, ({ column, property }) => `  ${property} String? @map("${column}")`),
    typeormTable: columnLines(
      columns,
      ({ column, property }) => `    ${property}: { name: '${column}', type: 'text', nullable: true },`,
    ),
    typeormRow: columnLines(columns, ({ property }) => `  ${property}: string | null;`),
  };
}

/** The subject and the fields as the declaration of this ORM spells them, and the rows of two people as its tests write and expect them. */
function spelledVars(request: PersonalRequest, spelling: Spelling): RenderContext {
  const fields = request.fields.map(personalColumn);
  const subject = personalColumn(request.subject);
  const columns = request.subject === 'id' ? fields : [...fields, subject];

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
  };
}
