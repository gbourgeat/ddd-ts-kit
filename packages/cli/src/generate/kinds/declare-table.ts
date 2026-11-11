import type { RenderContext } from '../../templating';
import { renderTemplate, templateExists } from '../../templating';
import { applyWiring } from '../apply-wiring';
import type { Scope } from '../scope';
import { CliError } from '../../cli-error';
import { TABLES_FILES } from './tables-files';
import {
  keepsSinglePrismaSchema,
  PRISMA_MAIN_SCHEMA,
  PRISMA_SCHEMA_FOLDER,
  prismaSchemaOf,
  schemaOfContext,
  singlePrismaSchemaFound,
  singlePrismaSchemaSteps,
  withDatasourceSchema,
} from '../../prisma-schema';

/** A table a generator declares in the storage of a context. */
export interface DeclaredTable {
  /** The name of the table in the database. */
  readonly table: string;
  /** The folder of the templates that write it, per ORM; a file it does not hold is the one of `repository`. */
  readonly templates: string;
  /** How to change a table already declared, since the generator declares it once. */
  readonly changedBy: string;
}

/** A table or a model, declared where the migration tooling of the ORM reads it; nothing without an ORM of the kit. */
export function declareTable(scope: Scope, context: RenderContext, declared: DeclaredTable): void {
  const { orm } = scope.config.stack;
  const tablesFile = TABLES_FILES[orm];

  if (orm === 'prisma') {
    declarePrismaModel(scope, context, declared);
  }

  if (tablesFile === undefined) {
    return;
  }

  const template = (file: string): string => templateOf(declared, `${orm}/${file}`);
  const directory = `${scope.dir}/infrastructure/persistence`;
  const tables = `${directory}/${tablesFile(scope.context.kebab)}.ts`;

  if (orm === 'knex') {
    scope.ws.create(
      `${directory}/${scope.context.kebab}.schema.ts`,
      renderTemplate(template('schema.ts.tpl'), context),
    );

    scope.ws.create(tables, renderTemplate(template('tables.ts.tpl'), context));
  } else {
    scope.ws.create(tables, renderTemplate(template('schema.ts.tpl'), context));
  }

  declareOnce(scope, { file: tables, declared }, renderTemplate(template('table.tpl'), context));

  applyWiring(
    scope.ws,
    `${scope.config.platformDir}/database/schema.ts`,
    renderTemplate(template('schema-export.tpl'), context),
  );
}

/** The template of the kind that declares the table, or the one a repository starts the same file with. */
function templateOf({ templates }: DeclaredTable, file: string): string {
  const own = `${templates}/${file}`;

  return templateExists(own) ? own : `repository/${file}`;
}

/**
 * A command run again with the same options adds nothing, its block being there already. Run again with others
 * (`--personal`, `--tenant-scoped`, `--field`), it would declare the table a second time under the same name, and
 * every spec that loads the file would fail on the name declared twice: it is refused, the file left as it was.
 * A table is counted where it is declared (`.table(`, `createTable(`, `tableName:`, `@@map(`): a column may bear
 * the name of another table.
 */
function declareOnce(
  scope: Scope,
  { file, declared }: { file: string; declared: DeclaredTable },
  wiring: string,
): void {
  const named = new RegExp(
    `(?:\\btable\\(\\s*|\\bcreateTable\\(|\\btableName: |@@map\\()['"]${declared.table}['"]`,
    'g',
  );

  const count = (): number => scope.ws.read(file)?.match(named)?.length ?? 0;
  const before = count();

  applyWiring(scope.ws, file, wiring);

  if (before > 0 && count() > before) {
    throw new CliError(
      `${file} already declares the table ${declared.table}, with other columns than this command would write.`,
      declared.changedBy.replace('<file>', file),
    );
  }
}

/**
 * Prisma reads the files of one folder: the model joins the file of its context, which the worker
 * of the context owns, and the database schema of the context the datasource of the main file.
 */
function declarePrismaModel(scope: Scope, context: RenderContext, declared: DeclaredTable): void {
  const models = prismaSchemaOf(scope.context.kebab);

  if (keepsSinglePrismaSchema((file) => scope.ws.exists(file))) {
    throw new CliError(
      `${singlePrismaSchemaFound()} The model would go to ${models}, which Prisma reads only once prisma.config.ts names ${PRISMA_SCHEMA_FOLDER}.`,
      `${singlePrismaSchemaSteps(Object.keys(scope.config.contexts))} Then run this command again.`,
    );
  }

  if (scope.ws.read(models) === undefined) {
    scope.ws.create(models, renderTemplate('repository/prisma/schema.prisma.tpl', context));
  }

  declareOnce(scope, { file: models, declared }, renderTemplate(templateOf(declared, 'prisma/model.tpl'), context));

  const content = scope.ws.read(PRISMA_MAIN_SCHEMA);

  if (content !== undefined) {
    scope.ws.update(PRISMA_MAIN_SCHEMA, withDatasourceSchema(content, schemaOfContext(scope.context.kebab)));
  }

  scope.ws.note(`${models} changed: run \`npm run db:client\` to regenerate the client and the schema of the tests.`);
}
