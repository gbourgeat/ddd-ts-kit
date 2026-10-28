import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error';

/** The script of the CLI of an ORM installed in the project; stops with the way to install it when it is missing. */
export function ormToolEntry(root: string, bin: string): string {
  const entry = path.join(root, 'node_modules', bin);

  if (!fs.existsSync(entry)) {
    throw new CliError(
      `${bin.split('/')[0] ?? bin} is not installed in ${root}.`,
      'Run `npm install` in the project first.',
    );
  }

  return entry;
}
