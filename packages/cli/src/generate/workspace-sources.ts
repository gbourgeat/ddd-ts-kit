import { loadSourceFile } from '../check/project/load-source-file.js';
import type { SourceFile } from '../check/model/source-file.js';
import type { Config } from '../config/index.js';
import type { Sources } from '../declared/index.js';
import type { Workspace } from '../workspace/index.js';

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
