import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';

/** The entry file of the drizzle-kit installed in the project, run by the same node: no shell, on every platform. */
export function drizzleKitBin(root: string): string {
  const bin = path.join(root, 'node_modules', 'drizzle-kit', 'bin.cjs');

  if (!fs.existsSync(bin)) {
    throw new CliError(`drizzle-kit is not installed in ${root}.`, 'Run `npm install` in the project first.');
  }

  return bin;
}
