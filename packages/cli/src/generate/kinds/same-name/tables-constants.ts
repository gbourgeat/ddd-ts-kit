import type { Config } from '../../../config';
import { workspaceSources } from './workspace-sources';
import type { Workspace } from '../../../workspace';
import { readTablesFile } from './read-tables-file';
import { tablesFileOf } from './tables-file-of';

/** Every name the tables files of the contexts export, as far as they are read: the names a schema index may come to hold. */
export function tablesConstants(ws: Workspace, config: Config): string[] {
  return Object.keys(config.contexts).flatMap((context) =>
    readTablesFile(workspaceSources(ws, config), tablesFileOf(ws, config, context)).symbols.map(({ name }) => name),
  );
}
