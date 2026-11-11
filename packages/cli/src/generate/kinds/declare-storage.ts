import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { renderTemplate } from '../../templating';
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

/** The table or model of the aggregate, declared where the migration tooling of the ORM reads it. */
export function declareStorage(scope: Scope, aggregate: Name, context: RenderContext): void {
  const { orm } = scope.config.stack;
  const tablesFile = TABLES_FILES[orm];

  if (orm === 'prisma') {
    declarePrismaModel(scope, aggregate, context);
  }

  if (tablesFile === undefined) {
    return;
  }

  const directory = `${scope.dir}/infrastructure/persistence`;
  const tables = `${directory}/${tablesFile(scope.context.kebab)}.ts`;

  if (orm === 'knex') {
    scope.ws.create(
      `${directory}/${scope.context.kebab}.schema.ts`,
      renderTemplate('repository/knex/schema.ts.tpl', context),
    );

    scope.ws.create(tables, renderTemplate('repository/knex/tables.ts.tpl', context));
  } else {
    scope.ws.create(tables, renderTemplate(`repository/${orm}/schema.ts.tpl`, context));
  }

  declareOnce(scope, { file: tables, table: aggregate.table }, renderTemplate(`repository/${orm}/table.tpl`, context));

  applyWiring(
    scope.ws,
    `${scope.config.platformDir}/database/schema.ts`,
    renderTemplate(`repository/${orm}/schema-export.tpl`, context),
  );
}

/**
 * A command run again with the same options adds nothing, its block being there already. Run again with others
 * (`--personal`, `--tenant-scoped`), it would declare the table a second time under the same name, and every
 * spec that loads the file would fail on the name declared twice: it is refused, the file left as it was.
 */
function declareOnce(scope: Scope, { file, table }: { file: string; table: string }, wiring: string): void {
  const named = new RegExp(`['"]${table}['"]`, 'g');
  const declared = (): number => scope.ws.read(file)?.match(named)?.length ?? 0;
  const before = declared();

  applyWiring(scope.ws, file, wiring);

  if (before > 0 && declared() > before) {
    throw new CliError(
      `${file} already declares the table ${table}, with other columns than this command would write.`,
      `Change the table by hand in ${file}, a personal field with its line in the *.personal-fields.ts of the aggregate; the generator declares a table once.`,
    );
  }
}

/**
 * Prisma reads the files of one folder: the model joins the file of its context, which the worker
 * of the context owns, and the database schema of the context the datasource of the main file.
 */
function declarePrismaModel(scope: Scope, aggregate: Name, context: RenderContext): void {
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

  declareOnce(scope, { file: models, table: aggregate.table }, renderTemplate('repository/prisma/model.tpl', context));

  const content = scope.ws.read(PRISMA_MAIN_SCHEMA);

  if (content !== undefined) {
    scope.ws.update(PRISMA_MAIN_SCHEMA, withDatasourceSchema(content, schemaOfContext(scope.context.kebab)));
  }

  scope.ws.note(`${models} changed: run \`npm run db:client\` to regenerate the client and the schema of the tests.`);
}
