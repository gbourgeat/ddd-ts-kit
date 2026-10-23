import { read } from '../helpers';

/** A JSON file of a generated project, as the unknown value it is: read it with `jsonAt` or match it. */
export function readJson(root: string, file: string): unknown {
  const parsed: unknown = JSON.parse(read(root, file));

  return parsed;
}
