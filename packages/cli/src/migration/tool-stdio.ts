import type { StdioOptions } from 'node:child_process';

let onStderr = false;

/** Where the tool of an ORM writes: the terminal as is, or its stderr while the command answers JSON on stdout. */
export function toolStdio(): StdioOptions {
  return onStderr ? ['inherit', 2, 'inherit'] : 'inherit';
}

/** Runs `run` with the output of the tools of an ORM sent to stderr, so that stdout holds the answer alone. */
export function withToolOutputOnStderr<T>(run: () => T): T {
  const before = onStderr;

  onStderr = true;

  try {
    return run();
  } finally {
    onStderr = before;
  }
}
