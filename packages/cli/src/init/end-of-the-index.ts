import type { Config } from '../config';
import { keepThePicture } from '../generate/kinds/same-name/keep-the-picture';
import type { Workspace } from '../workspace';

/**
 * The notes of the wiring, then the one comparison of the schema index the command makes, on the
 * state it ends in: what the index gave on disk before `init` is what it gives after, or it is
 * left as it stood (`keepThePicture`).
 */
export function endOfTheIndex(ws: Workspace, config: Config, notes: readonly string[]): void {
  notes.forEach((note) => {
    ws.note(note);
  });

  keepThePicture(ws, config, 'init');
}
