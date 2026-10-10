import { editConfigText } from '../../../config/index.js';
import type { Workspace } from '../../../workspace/index.js';

type Json = Record<string, unknown>;

/** Changes a JSON file of the project through its value; a file that is not there is said in a note. */
export function editJson(ws: Workspace, file: string, edit: (raw: Json) => void): void {
  const text = ws.read(file);

  if (text === undefined) ws.note(`${file} does not exist: nothing was added to it.`);
  else ws.update(file, editConfigText(text, edit));
}
