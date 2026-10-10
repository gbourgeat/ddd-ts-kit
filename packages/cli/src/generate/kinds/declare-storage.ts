import type { RenderContext } from '../../templating/index.js';
import { renderTemplate } from '../../templating/index.js';
import { applyWiring } from '../apply-wiring.js';
import type { Scope } from '../scope.js';

/** Where each ORM declares the tables of a context: the file its migration tooling reads, and the template that starts it. */
const TABLES_FILES: Readonly<Record<string, (context: string) => string>> = {
  drizzle: (context) => `${context}.schema`,
  typeorm: (context) => `${context}.schema`,
  knex: (context) => `create-${context}-tables.schema`,
};

/** The table or model of the aggregate, declared where the migration tooling of the ORM reads it. */
export function declareStorage(scope: Scope, context: RenderContext): void {
  const { orm } = scope.config.stack;
  const tablesFile = TABLES_FILES[orm];

  if (orm === 'prisma') {
    declarePrismaModel(scope, context);
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

  applyWiring(scope.ws, tables, renderTemplate(`repository/${orm}/table.tpl`, context));

  applyWiring(
    scope.ws,
    `${scope.config.platformDir}/database/schema.ts`,
    renderTemplate(`repository/${orm}/schema-export.tpl`, context),
  );
}

const PRISMA_SCHEMA = 'prisma/schema.prisma';

/** Prisma has one schema file for the whole project: the model joins it, and its database schema the datasource. */
function declarePrismaModel(scope: Scope, context: RenderContext): void {
  applyWiring(scope.ws, PRISMA_SCHEMA, renderTemplate('repository/prisma/model.tpl', context));

  const schema = scope.context.kebab.replaceAll('-', '_');
  const content = scope.ws.read(PRISMA_SCHEMA);

  if (content === undefined || new RegExp(`schemas\\s*=\\s*\\[[^\\]]*"${schema}"`).test(content)) {
    return;
  }

  scope.ws.update(PRISMA_SCHEMA, content.replace(/(schemas\s*=\s*\[[^\]]*)\]/, `$1, "${schema}"]`));

  scope.ws.note(
    'prisma/schema.prisma changed: run `npm run db:client` to regenerate the client and the schema of the tests.',
  );
}
