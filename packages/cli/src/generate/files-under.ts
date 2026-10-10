import type { Workspace } from '../workspace/index.js';

/** Every file below `directory`, on disk or planned, relative to it. */
export function filesUnder(ws: Workspace, directory: string, inside = ''): string[] {
  const here = inside === '' ? directory : `${directory}/${inside}`;
  const prefix = inside === '' ? '' : `${inside}/`;
  const files = ws.list(here).map((name) => `${prefix}${name}`);

  return [...files, ...ws.directories(here).flatMap((child) => filesUnder(ws, directory, `${prefix}${child}`))];
}
