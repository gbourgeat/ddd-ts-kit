import type { Config } from '../../../config';
import type { Workspace } from '../../../workspace';
import { type IndexReading, readIndex } from './index-reading';
import { tablesFileOf } from './tables-file-of';

/** The schema index of the project a workspace holds, read with the tables files it re-exports. */
export function workspaceIndex(ws: Workspace, config: Config): IndexReading {
  return readIndex(config, {
    index: `${config.platformDir}/database/schema.ts`,
    read: (file) => ws.read(file),
    tablesFile: (context) => tablesFileOf(ws, config, context),
    place: (file) => ws.placed(file),
  });
}
