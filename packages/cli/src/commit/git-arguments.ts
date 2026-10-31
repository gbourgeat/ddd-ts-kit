/** The subcommands the CLI runs that change nothing in the repository: no hook of the project has a reason to run there. */
const READ_ONLY = new Set([
  'blame',
  'branch',
  'cat-file',
  'check-ignore',
  'diff',
  'for-each-ref',
  'grep',
  'log',
  'ls-files',
  'ls-tree',
  'merge-base',
  'patch-id',
  'remote',
  'rev-list',
  'rev-parse',
  'show',
  'status',
  'var',
  'version',
]);

/** The options of git before its subcommand that take the next word as their value. */
const VALUED_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);

/**
 * The arguments of every git the CLI runs. A `core.fsmonitor` planted in the configuration of the
 * repository never runs, and no optional lock is taken, so that a read does not refresh the index
 * and start the `post-index-change` hook. A run that changes nothing also runs no hook of the
 * project (`core.hooksPath=/dev/null`); `commit`, `merge` and the other writes keep them, since
 * they are the gates of the project.
 */
export function gitArguments(args: readonly string[]): string[] {
  const hooks = READ_ONLY.has(subcommandOf(args) ?? '') ? ['-c', 'core.hooksPath=/dev/null'] : [];

  return ['-c', 'core.fsmonitor=false', ...hooks, '--no-optional-locks', ...args];
}

function subcommandOf(args: readonly string[]): string | undefined {
  for (let at = 0; at < args.length; at += VALUED_OPTIONS.has(args[at] ?? '') ? 2 : 1) {
    if (!args[at]?.startsWith('-')) {
      return args[at];
    }
  }

  return undefined;
}
