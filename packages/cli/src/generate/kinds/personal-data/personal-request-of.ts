import { CONFIG_FILE, type OrmStack } from '../../../config';
import { CliError } from '../../../cli-error';
import type { Scope } from '../../scope';

/** What `--personal` asks for: the personal columns of the table, the column that names the data subject, how the rows of a subject are erased. */
export interface PersonalRequest {
  readonly fields: readonly string[];
  readonly subject: string;
  readonly erasure: 'pseudonymise' | 'row';
  /** `--retention`: the date column the period runs from, and the period; absent, the rows are kept until the person asks. */
  readonly retention?: RetentionRequest;
}

interface RetentionRequest {
  readonly column: string;
  readonly unit: 'days' | 'months' | 'years';
  readonly amount: number;
}

const COLUMN = /^[a-z][a-z0-9_]*$/;
/** The columns every generated table has for its own needs: none holds personal data, and only `id` names a subject. */
const OWN_COLUMNS = ['version', 'registered_at', 'tenant_id', 'created_at', 'created_by', 'updated_at', 'updated_by'];
const MODES: readonly PersonalRequest['erasure'][] = ['pseudonymise', 'row'];
/** The ORMs whose package ships the erasure adapter that reads a declaration. */
const ADAPTED: readonly OrmStack[] = ['knex', 'drizzle', 'prisma', 'typeorm'];

/** The request of `--personal`, checked before anything is written; nothing without the flag, and then `--subject` or `--erasure` alone is refused. */
export function personalRequestOf(scope: Scope): PersonalRequest | undefined {
  const { personal, subject = 'id', erasure = 'pseudonymise', retention } = scope.flags;

  if (personal === undefined) {
    assertNothingAlone(scope);

    return undefined;
  }

  assertPrivacyOn(scope);

  const fields = columnsOf(personal);

  assertSubject(subject, fields);

  return {
    fields,
    subject,
    erasure: modeOf(erasure),
    ...(retention === undefined ? {} : { retention: retentionOf(retention, [...fields, subject]) }),
  };
}

function assertNothingAlone(scope: Scope): void {
  if (scope.flags.subject === undefined && scope.flags.erasure === undefined && scope.flags.retention === undefined) {
    return;
  }

  throw new CliError(
    '--subject, --erasure and --retention go with --personal.',
    'Add --personal <column>,<column> to declare the personal columns the subject owns.',
  );
}

/** The declaration is read by the erasure of the context, which the platform runs: both exist with `--privacy on` and one of the four ORMs. */
function assertPrivacyOn(scope: Scope): void {
  const { privacy, orm } = scope.config.stack;

  if (privacy !== 'on') {
    throw new CliError(
      'This project answers no request of a data subject (stack.privacy is "off").',
      `Run \`ddd-ts-kit init --force --privacy on\` to write src/platform/privacy/ and its scripts, recorded in ${CONFIG_FILE}, then declare the personal columns again.`,
    );
  }

  if (!ADAPTED.includes(orm)) {
    throw new CliError(
      `--personal is generated for knex, drizzle, prisma and typeorm: with --orm ${orm}, no erasure adapter of the kit reads the declaration.`,
      'Write the declaration with personalFields of @ddd-ts-kit/kernel next to your adapter, a class that extends PersonalDataErasure and passes personalDataErasureContract of @ddd-ts-kit/testing, and list it in src/platform/privacy/data-subject-copies.ts.',
    );
  }
}

function columnsOf(personal: string): readonly string[] {
  const fields = personal
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field !== '');

  if (fields.length === 0) {
    throw new CliError(
      '--personal names no column.',
      'Name the personal columns of the table, comma separated: --personal email,display_name.',
    );
  }

  for (const field of fields) {
    assertColumn(field, '--personal');
  }

  if (new Set(fields).size !== fields.length) {
    throw new CliError('--personal lists a column twice.', 'Name each personal column once.');
  }

  return fields;
}

/** A column name as the database spells it, and none the generated table keeps for itself. */
function assertColumn(column: string, flag: string): void {
  if (!COLUMN.test(column)) {
    throw new CliError(
      `${flag} names "${column}", which is not a column name.`,
      'Use the SQL name of each column: lower case letters, digits and underscores (customer_email), comma separated.',
    );
  }

  if (OWN_COLUMNS.includes(column) || (column === 'id' && flag === '--personal')) {
    throw new CliError(
      `${flag} names "${column}", a column every generated table keeps for its own needs.`,
      'The identifier, the version, registered_at, tenant_id and the audit columns hold no personal data: name the columns of the state that do.',
    );
  }
}

/** A data subject is named by an opaque identifier, which is never personal data itself. */
function assertSubject(subject: string, fields: readonly string[]): void {
  assertColumn(subject, '--subject');

  if (fields.includes(subject)) {
    throw new CliError(
      `--subject "${subject}" is also listed in --personal.`,
      'A data subject is named by an opaque identifier, never by personal data: pick the column that holds the id of the person, `id` when the row is the person.',
    );
  }
}

function modeOf(erasure: string): PersonalRequest['erasure'] {
  const mode = MODES.find((candidate) => candidate === erasure);

  if (mode === undefined) {
    throw new CliError(
      `--erasure ${erasure} is not a mode of erasure.`,
      'Use pseudonymise (the row stays, each personal column reads [erased]) or row (the row of the subject is deleted).',
    );
  }

  return mode;
}

const RETENTION = /^([a-z][a-z0-9_]*):([1-9][0-9]*)([dmy])$/;
const UNITS: Readonly<Record<string, RetentionRequest['unit']>> = { d: 'days', m: 'months', y: 'years' };

/**
 * `--retention <column>:<n><d|m|y>`: the period, one unit, from a column that dates the end of the
 * relation with the person (`ended_at`, `closed_at`), which joins the storage as a nullable
 * timestamp, empty while the relation lasts. Never a column the table keeps for itself:
 * `registered_at` dates the beginning, and a purge counted from it would erase, every night and for
 * good, people who are still customers.
 */
function retentionOf(text: string, named: readonly string[]): RetentionRequest {
  const match = RETENTION.exec(text);
  const [, column = '', amount = '', unit = ''] = match ?? [];
  const known = UNITS[unit];

  if (match === null || known === undefined) {
    throw new CliError(
      `--retention "${text}" is not a retention.`,
      'Write the column that dates the end of the relation, then the period in days, months or years: --retention ended_at:36m, --retention closed_at:10y.',
    );
  }

  assertRetentionColumn(column, named);

  return { column, unit: known, amount: Number(amount) };
}

/** A retention runs from the end of the relation: neither a personal column, nor the subject, nor a column the table keeps for itself. */
function assertRetentionColumn(column: string, named: readonly string[]): void {
  const own = OWN_COLUMNS.includes(column) || column === 'id';

  if (named.includes(column) || own) {
    throw new CliError(
      `--retention runs from "${column}", which is ${own ? 'a column the generated table keeps for its own needs' : 'named by --personal or --subject'}.`,
      own
        ? 'A retention runs from the end of the relation with the person, never from its beginning: counted from registered_at, the nightly purge would erase people who are still customers. Name a column that dates the end (ended_at, closed_at): it joins the table, empty while the relation lasts.'
        : 'A retention runs from the end of the relation with the person: name a column that dates it (ended_at, closed_at), which joins the table, empty while the relation lasts.',
    );
  }
}
