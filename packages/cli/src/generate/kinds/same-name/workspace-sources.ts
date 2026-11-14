import type { Config } from '../../../config';
import type { Workspace } from '../../../workspace';
import { type Sources, sourcesOf } from './sources-of';

/** The one resolver over the files a workspace holds, each by the path the workspace reads it at. */
export function workspaceSources(ws: Workspace, config: Config): Sources {
  return sourcesOf(
    config,
    (file) => ws.read(file),
    (file) => ws.placed(file),
  );
}
