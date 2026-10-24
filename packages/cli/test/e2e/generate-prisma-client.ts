import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../helpers';
import { bin, runIn } from './run-in';

/**
 * The Prisma client of a generated project, a build product its sources import: generated with the
 * dependencies of the workspace, lent to the project for the time of the command, as its own
 * `prebuild` would with its own.
 */
export function generatePrismaClient(root: string): void {
  const lent = path.join(root, 'node_modules');

  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), lent, 'dir');

  try {
    runIn(root, { command: bin('prisma'), args: ['generate'] });
  } finally {
    fs.unlinkSync(lent);
  }
}
