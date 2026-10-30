import { CliError } from './cli-error';

/** Whether the arguments of a command make it reach a package manager. */
type Reaches = (rest: readonly string[]) => boolean;

const always: Reaches = () => true;
const unlessSkipped: Reaches = (rest) => !has(rest, '--no-install') && !has(rest, '--dry-run');

/**
 * The commands that run a script of the project or install its dependencies (`runScript` and
 * `installDependencies`), each with the arguments that make it do so. A spec lists every call of
 * those two and fails when one is reached by a command that is not here.
 */
export const SCRIPT_RUNNERS: Readonly<Record<string, Reaches>> = {
  affected: (rest) => has(rest, '--run'),
  'verify-slice': always,
  'worker-scope': unlessSkipped,
  'story-scope': unlessSkipped,
  worktree: unlessSkipped,
  'merge-trunk': always,
};

/**
 * On Windows the package manager is reached through `cmd.exe`, which passes the arguments of a
 * script unescaped (`affected --run "test & calc"` would run `calc`). Windows is supported through
 * WSL 2, where the platform is `linux`: a command that would run a script is refused at its entry,
 * before any work.
 */
export function refuseWindowsShell(platform: NodeJS.Platform, command: string, rest: readonly string[]): void {
  if (platform !== 'win32' || !Object.hasOwn(SCRIPT_RUNNERS, command) || !SCRIPT_RUNNERS[command]?.(rest)) {
    return;
  }

  throw new CliError(
    'On Windows, ddd-ts-kit runs the scripts of the project under WSL 2 only: outside it the package manager is reached through cmd.exe, which passes the arguments of a script unescaped.',
    'Run this command under WSL 2 (docs/guides/agent-sandbox.md).',
  );
}

function has(rest: readonly string[], flag: string): boolean {
  return rest.some((argument) => argument === flag || argument.startsWith(`${flag}=`));
}
