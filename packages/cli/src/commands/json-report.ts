import type { WorkspaceReport } from '../workspace';

/** The lists of a report that hold paths, in the order `--json` prints them. */
const PATH_LISTS = ['created', 'updated', 'deleted', 'skipped', 'kept', 'unwritable'] as const;

/**
 * What `--json` prints of a report: `dryRun` only when it is one, the directory every path shares
 * said once as `root` and each path written from it, then only the lists that hold something.
 * A reader joins `root` and a path to find the file; an absent list is an empty one.
 */
export function jsonReport(report: WorkspaceReport, dryRun: boolean): Record<string, unknown> {
  const root = sharedDirectory([
    ...PATH_LISTS.flatMap((list) => report[list]),
    ...report.todos.map(({ file }) => file),
  ]);

  const fromRoot = (file: string): string => file.slice(root.length);

  const lists = PATH_LISTS.filter((list) => report[list].length > 0).map((list): [string, string[]] => [
    list,
    report[list].map(fromRoot),
  ]);

  const todos = report.todos.map((todo) => ({ ...todo, file: fromRoot(todo.file) }));

  return {
    ...(dryRun ? { dryRun } : {}),
    ...(root === '' ? {} : { root }),
    ...Object.fromEntries(lists),
    ...(todos.length === 0 ? {} : { todos }),
    ...(report.notes.length === 0 ? {} : { notes: report.notes }),
  };
}

/** `src/contexts/ordering/` when every path starts with it; nothing when one sits at the root of the project, or there is none. */
function sharedDirectory(files: readonly string[]): string {
  const [first, ...others] = files;
  let shared = first === undefined ? '' : directoryOf(first);

  for (const file of others) {
    while (!file.startsWith(shared)) {
      shared = directoryOf(shared.slice(0, -1));
    }
  }

  return shared;
}

/** `src/contexts/` of `src/contexts/ordering`, with its slash; nothing at the root. */
function directoryOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/') + 1);
}
