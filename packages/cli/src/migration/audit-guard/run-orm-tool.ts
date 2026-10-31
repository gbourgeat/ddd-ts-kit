import { spawnSync } from 'node:child_process';
import { toolStdio } from '../tool-stdio';
import { ormToolEntry } from './orm-tool-entry';

/** Runs the CLI of an ORM installed in the project with the node that runs this one, in the terminal of the caller. */
export function runOrmTool(root: string, bin: string, args: readonly string[]): number {
  const entry = ormToolEntry(root, bin);

  return spawnSync(process.execPath, [entry, ...args], { cwd: root, stdio: toolStdio() }).status ?? 1;
}
