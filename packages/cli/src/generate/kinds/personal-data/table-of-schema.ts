import { CliError } from '../../../cli-error';
import { prismaSchemaOf } from '../../../prisma-schema';
import type { Scope } from '../../scope';
import { TABLES_FILES } from '../tables-files';
import type { SchemaTable } from './schema-table';
import { schemaTablesOf } from './schema-tables-of';

const TABLE = /^[a-z][a-z0-9_]*$/;

/** A table of the schema of a context, and the file that declares it, where it is today. */
export interface FoundTable {
  readonly table: SchemaTable;
  readonly file: string;
}

/**
 * The table `generate personal-fields` declares the personal columns of: one the schema of the
 * context already holds, in the file its ORM reads (`<context>.schema.ts` on Drizzle and TypeORM,
 * `create-<context>-tables.schema.ts` on Knex, `prisma/schema/<context>.prisma` on Prisma). The
 * generator writes no table: one the schema does not declare is refused, with the ones it does.
 */
export function tableOfSchema(scope: Scope, name: string): FoundTable {
  if (!TABLE.test(name)) {
    throw new CliError(
      `"${name}" is not a table name.`,
      'Name the table as the database spells it: lower case letters, digits and underscores (received_messages).',
    );
  }

  const asked = schemaFileOf(scope);
  const file = scope.ws.placed(asked);
  const tables = schemaTablesOf(scope.config.stack.orm, scope.ws.read(asked) ?? '');
  const table = tables.find((candidate) => candidate.name === name);

  if (table === undefined) {
    throw undeclared(scope, { name, file, tables });
  }

  scope.flags.builtOn?.(file);

  return { table, file };
}

function schemaFileOf(scope: Scope): string {
  const context = scope.context.kebab;
  const tablesFile = TABLES_FILES[scope.config.stack.orm];

  return tablesFile === undefined
    ? prismaSchemaOf(context)
    : `${scope.dir}/infrastructure/persistence/${tablesFile(context)}.ts`;
}

interface Undeclared {
  readonly name: string;
  readonly file: string;
  readonly tables: readonly SchemaTable[];
}

function undeclared(scope: Scope, { name, file, tables }: Undeclared): CliError {
  const context = scope.context.kebab;
  const names = tables.map((table) => table.name).sort();
  const held = names.length === 0 ? 'none yet' : names.join(', ');

  return new CliError(
    `The schema of ${context} (${file}) declares no table "${name}".`,
    `This generator declares what a table of the project keeps of a person, it writes no table: name one the schema declares (${held}), or write the table in ${file} first. The table of an aggregate comes with \`ddd-ts-kit generate repository ${context} <Aggregate> --personal <column>,...\`.`,
  );
}
