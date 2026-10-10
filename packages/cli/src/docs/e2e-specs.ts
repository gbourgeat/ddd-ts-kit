import path from 'node:path';
import type { Workspace } from '../workspace/index.js';

/** The use cases an end-to-end spec drives. */
export function e2eSpecs(ws: Workspace): string[] {
  return ws
    .list('test/e2e')
    .filter((file) => file.endsWith('.e2e.spec.ts'))
    .map((file) => path.posix.basename(file, '.e2e.spec.ts'));
}
