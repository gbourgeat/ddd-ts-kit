import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { contextVars } from '../generate/context-vars';
import { listedEntity } from '../generate/kinds/same-name/listed-entity';
import { tablesConstants } from '../generate/kinds/same-name/tables-constants';
import { TABLES_FILES } from '../generate/kinds/tables-files';
import { isSourceOfContext, listedInIndex } from '../migration';
import { heldFileOf, treeOf } from '../model-modules';
import { parseContextName, type Name } from '../naming';
import { PRISMA_MAIN_SCHEMA, prismaSchemaOf, schemaOfContext, withDatasourceSchema } from '../prisma-schema';
import { renderTemplate } from '../templating';
import type { Workspace } from '../workspace';
import { withHeldImports } from './with-held-imports';

const TYPEORM_TABLE = /^export const (\w+) = new EntitySchema\b/gm;

/**
 * The tables of a context stay known to the migration tooling: a context whose tables file the
 * schema index does not name (a project whose earlier `--force` emptied the index, a region the
 * template no longer holds) joins it again, and the database schema of its models the datasource
 * on Prisma. What the index names already is left as it is, however it is written.
 */
export function rewireTables(ws: Workspace, config: Config, name: string): void {
  const context = parseContextName(name);
  const { orm } = config.stack;

  if (orm === 'prisma') {
    relistInDatasource(ws, context);

    return;
  }

  const file = TABLES_FILES[orm]?.(context.kebab);
  const index = `${config.platformDir}/database/schema.ts`;
  const tables = ws.read(heldFileOf(ws, treeOf(config, context.kebab), `infrastructure/persistence/${file}.ts`));

  if (file === undefined || tables === undefined || !ws.exists(index)) {
    return;
  }

  const isOfItsContext = (source: string): boolean =>
    isSourceOfContext(config, { from: index, source, context: context.kebab });

  for (const { listed, constant } of entriesOf(orm, { context, file, tables })) {
    const held = ws.read(index) ?? '';

    if (!listedInIndex(held, { ...listed, isOfItsContext })) {
      const reserved = tablesConstants(ws, config);
      const entity = listedEntity(held, { context, constant, reserved, isOfItsContext });
      const vars = { ...contextVars(config, context), listed: { ...entity } };

      applyWiring(ws, index, withHeldImports(ws, config, renderTemplate(`repository/${orm}/schema-export.tpl`, vars)));
    }
  }
}

function relistInDatasource(ws: Workspace, context: Name): void {
  const main = ws.read(PRISMA_MAIN_SCHEMA);

  if (main !== undefined && ws.exists(prismaSchemaOf(context.kebab))) {
    ws.update(PRISMA_MAIN_SCHEMA, withDatasourceSchema(main, schemaOfContext(context.kebab)));
  }
}

/** One line of the schema index: what shows it is there, and the constant its wiring names. */
interface IndexEntry {
  readonly listed: Parameters<typeof listedInIndex>[1];
  readonly constant: string;
}

interface TablesFile {
  readonly context: Name;
  /** The name of the tables file, without its extension. */
  readonly file: string;
  readonly tables: string;
}

function entriesOf(orm: string, { context, file, tables }: TablesFile): IndexEntry[] {
  switch (orm) {
    case 'knex':
      return [
        { listed: { file, constant: `create${context.pascal}Tables` }, constant: `create${context.pascal}Tables` },
      ];
    case 'drizzle':
      return [{ listed: { file }, constant: `${context.camel}Schema` }];
    default:
      return [...tables.matchAll(TYPEORM_TABLE)].map(([, table = '']) => ({
        listed: { file, constant: table },
        constant: table,
      }));
  }
}
