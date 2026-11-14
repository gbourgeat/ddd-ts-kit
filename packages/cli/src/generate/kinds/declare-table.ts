import type { RenderContext } from '../../templating';
import { workspaceSources } from './same-name/workspace-sources';
import { renderTemplate, templateExists } from '../../templating';
import { applyWiring } from '../apply-wiring';
import type { Scope } from '../scope';
import { CliError } from '../../cli-error';
import { isSourceOfContext } from '../../migration';
import { listedEntity } from './same-name/listed-entity';
import { readTablesFile } from './same-name/read-tables-file';
import { settleSameNames } from './same-name/settle-same-names';
import { tablesConstants } from './same-name/tables-constants';
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
  /** The constant the tables file exports it under, on the ORM that have one: the Drizzle table, the TypeORM entity. */
  readonly constant: string;
  /** The folder of the templates that write it, per ORM; a file it does not hold is the one of `repository`. */
  readonly templates: string;
  /** How to change a table already declared, since the generator declares it once; `<file>`, `<context>` and `<table>` are filled in. */
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

  const held = heldBefore(scope, { tables, constant: declared.constant });

  declareOnce(scope, { file: tables, declared }, renderTemplate(template('table.tpl'), context));

  listInIndex(scope, context, { ...declared, brought: held ? [] : [declared.constant] });
}

/**
 * Whether the tables file of the context exported the constant before this command: read, never a
 * word of its text. A context that held it is no newcomer to its name. One that exports it from
 * another file, a module it re-exports, is refused: the declaration this command would write
 * would take the name from the table that bears it, which would be in no migration any more.
 */
function heldBefore(
  { ws, config, context }: Scope,
  { tables, constant }: { tables: string; constant: string },
): boolean {
  const { symbols } = readTablesFile(workspaceSources(ws, config), tables);

  const held = symbols.find(({ name, kind }) => kind === 'value' && name === constant);
  const [from = ''] = held?.origin.split('#') ?? [];

  if (held !== undefined && from !== tables) {
    throw new CliError(
      `${tables} already exports \`${constant}\`, from ${from}: a table of that name declared in the tables file of ${context.kebab} would take its place, and the one that bears it would be listed nowhere.`,
      `Give the aggregate or the read model another name, or rename \`${constant}\` in ${from}.`,
    );
  }

  return held !== undefined;
}

/**
 * The tables file joins the schema index, which is all the migration tooling reads. A table of the
 * same name in another context is listed beside it, under a name of the index that carries its
 * context: the index would not compile otherwise, and one of the two tables would never be created.
 */
function listInIndex(scope: Scope, context: RenderContext, declared: Listed): void {
  const { config, ws } = scope;
  const index = `${config.platformDir}/database/schema.ts`;

  const listed = listedEntity(ws.read(index) ?? '', {
    context: scope.context,
    constant: declared.constant,
    reserved: tablesConstants(ws, config),
    isOfItsContext: (source) => isSourceOfContext(config, { from: index, source, context: scope.context.kebab }),
  });

  const wiring = renderTemplate(`repository/${config.stack.orm}/schema-export.tpl`, {
    ...context,
    listed: { ...listed },
  });

  applyWiring(ws, index, wiring);

  const said = namesSettled(scope, { declared, local: listed.local, wiring });

  // What the command ends with is compared with what the index gave, once, when every generator has run (`keepThePicture`).
  said.forEach((note) => {
    ws.note(note);
  });
}

/** A table to list in the index, with the names its command brings to its context. */
interface Listed extends DeclaredTable {
  readonly brought: readonly string[];
}

/** What the index says of the name it gives the table, once the names it shares with another are settled. */
function namesSettled(
  { config, ws, context }: Scope,
  { declared, local, wiring }: { declared: Listed; local: string; wiring: string },
): string[] {
  const index = `${config.platformDir}/database/schema.ts`;

  if (config.stack.orm === 'typeorm' && local !== declared.constant) {
    return [
      `${index} lists the entity \`${declared.constant}\` of ${context.kebab} as \`${local}\`: the index already holds the name \`${declared.constant}\`. The tables file and what reads it keep that name.`,
    ];
  }

  return config.stack.orm === 'drizzle'
    ? settleSameNames(ws, config, {
        newcomers: [context.kebab],
        brought: declared.brought,
        // The line as the index holds it: written at the path of the module that holds the tables file.
        stars: (wiring.match(/^export \* from .*$/gm) ?? []).map((line) => ws.withImports(index, line)),
      })
    : [];
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
      declared.changedBy
        .replace('<file>', file)
        .replace('<context>', scope.context.kebab)
        .replace('<table>', declared.table),
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
