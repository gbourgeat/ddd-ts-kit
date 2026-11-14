import type { Config } from '../../../config';
import { workspaceSources } from './workspace-sources';
import { namedBindingsOf } from '../../../migration';
import type { Workspace } from '../../../workspace';
import { entitiesList } from './entities-list';
import { readTablesFile } from './read-tables-file';
import { indexExports } from './index-exports';
import { workspaceIndex } from './workspace-index';

/** What a schema index gives the migration tooling at one moment: taken before a command writes it, and after. */
export interface IndexPicture {
  /** The index as it stood. */
  readonly text: string | undefined;
  /** On Drizzle, the value each name exports, by the place that declares it; a name that does not compile exports none. */
  readonly names: ReadonlyMap<string, string>;
  /** Every table within reach: on Drizzle a value exported under a name, on TypeORM an entity listed in `entities`. */
  readonly reachable: ReadonlySet<string>;
}

/**
 * The picture of the schema index a workspace holds. On Drizzle, what each name exports as a
 * value, read as the compiler resolves it. On TypeORM, the entities its `entities` lists, each by
 * the file it is imported from, resolved, and its name there: the names of the imports are local
 * to the index. On another ORM, nothing.
 */
export function indexPicture(ws: Workspace, config: Config): IndexPicture {
  const index = `${config.platformDir}/database/schema.ts`;
  const text = ws.read(index);

  if (text === undefined || !['drizzle', 'typeorm'].includes(config.stack.orm)) {
    return { text, names: new Map(), reachable: new Set() };
  }

  if (config.stack.orm === 'typeorm') {
    return { text, names: new Map(), reachable: entitiesListed(ws, config, { index, text }) };
  }

  const exported = [...indexExports(workspaceIndex(ws, config))];

  // What the index declares itself is the template's: a table is what a file it re-exports or names holds.
  const names = new Map(
    exported.flatMap(([name, { value }]) =>
      value === undefined || value.startsWith(`${index}#`) ? [] : [[name, value]],
    ),
  );

  return { text, names, reachable: new Set(names.values()) };
}

function entitiesListed(ws: Workspace, config: Config, { index, text }: { index: string; text: string }): Set<string> {
  const sources = workspaceSources(ws, config);

  const listed = new Set(entitiesList(text));

  return new Set(
    namedBindingsOf(text, 'import').flatMap(({ source, names }) => {
      const resolved = sources.resolve(index, source);
      const from = resolved.kind === 'file' ? resolved.path : source;
      const read = resolved.kind === 'file' ? readTablesFile(sources, resolved.path) : undefined;

      // An entity its file, read with certainty, no longer exports is listed in name only: the index does not compile.
      const isThere = (name: string): boolean =>
        read === undefined || read.unread.length > 0 || read.symbols.some((symbol) => symbol.name === name);

      return names.filter(({ local, name }) => listed.has(local) && isThere(name)).map(({ name }) => `${from}#${name}`);
    }),
  );
}
