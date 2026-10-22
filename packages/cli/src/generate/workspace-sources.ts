import { loadSourceFile } from '../check/project/load-source-file';
import type { SourceFile } from '../check/model/source-file';
import type { Config } from '../config';
import type { Sources } from '../declared';
import type { Workspace } from '../workspace';

/** The sources of a workspace, on disk or planned, each read and scanned once. */
export function workspaceSources(ws: Workspace, config: Config): Sources {
  const read = new Map<string, SourceFile | undefined>();

  return (file) => {
    if (!read.has(file)) {
      const text = ws.read(file);

      read.set(file, text === undefined ? undefined : loadSourceFile(config, file, text));
    }

    return read.get(file);
  };
}
