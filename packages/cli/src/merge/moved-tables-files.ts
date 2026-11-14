import type { Config } from '../config';
import type { FileReader } from '../generate/kinds/same-name/sources-of';
import { tablesFileOf } from '../generate/kinds/same-name/tables-file-of';
import type { Workspace } from '../workspace';
import { sideTablesFile } from './side-tables-file';

/**
 * The tables file of each context a side holds at a place the merged tree holds no file at: the
 * path on that side, to the one the merged tree holds for the context.
 */
export function movedTablesFiles(ws: Workspace, config: Config, read: FileReader): Map<string, string> {
  return new Map(
    Object.keys(config.contexts).flatMap((context) => {
      const atTheSide = sideTablesFile(config, read, context);
      const merged = tablesFileOf(ws, config, context);

      // A file the merged tree still holds at the side's place has not moved: the context holds two files, each its own.
      const isMoved = atTheSide !== merged && read(atTheSide) !== undefined && !ws.existsAsIs(atTheSide);

      return isMoved ? [[atTheSide, merged]] : [];
    }),
  );
}
