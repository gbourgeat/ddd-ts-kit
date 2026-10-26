import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error';

/** Runs the CLI of an ORM installed in the project with the node that runs this one, in the terminal of the caller. */
export function runOrmTool(root: string, bin: string, args: readonly string[]): number {
  const entry = path.join(root, 'node_modules', bin);

  if (!fs.existsSync(entry)) {
    throw new CliError(
      `${bin.split('/')[0] ?? bin} is not installed in ${root}.`,
      'Run `npm install` in the project first.',
    );
  }

  return spawnSync(process.execPath, [entry, ...args], { cwd: root, stdio: 'inherit' }).status ?? 1;
}
