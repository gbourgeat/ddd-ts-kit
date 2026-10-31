import type { CliResult } from './helpers';

interface Todo {
  file: string;
  line: number;
  gist: string;
  text?: string;
}

/** What `generate --json` says, read as a script reads it: each path joined to `root`, a list it leaves out empty. */
export interface Report {
  readonly dryRun: boolean;
  readonly created: string[];
  readonly updated: string[];
  readonly deleted: string[];
  readonly skipped: string[];
  readonly kept: string[];
  readonly unwritable: string[];
  /** Each place to decide at: the first words of its marker, and the whole sentence of a step no file holds. */
  readonly todos: Todo[];
  readonly notes: string[];
}

/** What `generate --json` prints: the lists that hold something, the paths from `root` when they share it. */
type Printed = Partial<Omit<Report, 'todos'>> & { readonly root?: string; readonly todos?: Todo[] };

export function report(result: Pick<CliResult, 'json'>): Report {
  const printed = result.json() as Printed;
  const root = printed.root ?? '';
  const whole = (files: readonly string[] = []): string[] => files.map((file) => `${root}${file}`);

  return {
    dryRun: printed.dryRun ?? false,
    created: whole(printed.created),
    updated: whole(printed.updated),
    deleted: whole(printed.deleted),
    skipped: whole(printed.skipped),
    kept: whole(printed.kept),
    unwritable: whole(printed.unwritable),
    todos: (printed.todos ?? []).map((todo) => ({ ...todo, file: `${root}${todo.file}` })),
    notes: printed.notes ?? [],
  };
}

/** What a refused command prints with `--json`. */
export function failure(result: CliResult): { message: string; fix: string } {
  return (result.json() as { error: { message: string; fix: string } }).error;
}
