import type { Workspace } from '../workspace';

/** Writes a file the generator owns whether it exists or not: it is reported created or updated. */
export function putFile(ws: Workspace, file: string, content: string): void {
  if (ws.exists(file)) {
    ws.update(file, content);
  } else {
    ws.create(file, content);
  }
}
