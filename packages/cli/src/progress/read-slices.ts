import type { Workspace } from '../workspace/index.js';
import type { Slice } from './slice.js';
import { slicesIn } from './slices-in.js';

export const SLICES_FILE = 'docs/architecture/slices.md';

/**
 * The rows of every slices table of the project, in the order of the file. Undefined when the
 * project has no slices file or the file has no such table.
 */
export function readSlices(ws: Workspace): Slice[] | undefined {
  return slicesIn(ws.read(SLICES_FILE) ?? '');
}
