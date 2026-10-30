import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { contextVars } from '../generate/context-vars';
import { TABLES_FILES } from '../generate/kinds/tables-files';
import { parseContextName, type Name } from '../naming';
import { PRISMA_MAIN_SCHEMA, prismaSchemaOf, schemaOfContext, withDatasourceSchema } from '../prisma-schema';
import { renderTemplate, type RenderValue } from '../templating';
import type { Workspace } from '../workspace';

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
  const tables = ws.read(`${config.contextsDir}/${context.kebab}/infrastructure/persistence/${file}.ts`);

  if (tables === undefined || !ws.exists(index)) {
    return;
  }

  for (const entry of entriesOf(orm, context, tables)) {
    if (!entry.named.test(ws.read(index) ?? '')) {
      applyWiring(
        ws,
        index,
        renderTemplate(`repository/${orm}/schema-export.tpl`, { ...contextVars(config, context), ...entry.vars }),
      );
    }
  }
}

function relistInDatasource(ws: Workspace, context: Name): void {
  const main = ws.read(PRISMA_MAIN_SCHEMA);

  if (main !== undefined && ws.exists(prismaSchemaOf(context.kebab))) {
    ws.update(PRISMA_MAIN_SCHEMA, withDatasourceSchema(main, schemaOfContext(context.kebab)));
  }
}

/** One line of the schema index: what shows it is there, and what its wiring needs. */
interface IndexEntry {
  readonly named: RegExp;
  readonly vars: Record<string, RenderValue>;
}

function entriesOf(orm: string, context: Name, tables: string): IndexEntry[] {
  switch (orm) {
    case 'knex':
      return [{ named: new RegExp(`\\bcreate${context.pascal}Tables\\b`), vars: {} }];
    case 'drizzle':
      return [{ named: new RegExp(`/${context.kebab}\\.schema\\b`), vars: {} }];
    default:
      return [...tables.matchAll(TYPEORM_TABLE)].map(([, table = '']) => ({
        named: new RegExp(`\\b${table}\\b`),
        vars: { aggregate: { tableCamel: table } },
      }));
  }
}
