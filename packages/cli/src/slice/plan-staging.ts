import type { Config } from '../config/index.js';
import { isDerived } from '../derived/is-derived.js';
import type { ChangedEntry } from './changed-entry.js';
import type { StagingPlan } from './staging-plan.js';

/** The kit's own working files: never committed, never listed. */
const KIT_FILES = '.ddd-ts-kit/';
/** An end-to-end spec, a place of a slice outside its context. */
const END_TO_END_SPEC = /^test\/e2e\/[^/]+\.e2e\.spec\.ts$/;
/** The acceptance spec of a story, whose scenarios a slice unwraps once it satisfies them; its lock is the conductor's. */
const ACCEPTANCE_SPEC = /^test\/acceptance\/[^/]+\.acceptance\.spec\.ts$/;
/** A working migration of a worker, `<number>_working-<what>`, as `db:generate working-<what>` writes it. */
const WORKING_MIGRATION = /^(?:.+\/)?migrations\/(?:.+\/)?(\d+)[_-]working[_-][^/]*$/;

/**
 * Splits the changed paths of the working tree between the slice of `context` and the rest, by a
 * closed list: a path is staged only when it belongs to the slice. The files of the context, an
 * end-to-end spec, an acceptance spec, a working migration with its snapshot and the journal, and the derived files
 * that `regenerate` rewrites when git already tracks them. Anything else (a file of another
 * context, of the platform, an editor's folder, notes, a document nobody asked to commit) is left
 * out, never proposed: committing it is a decision of a person, not of a slice.
 */
export function planStaging(entries: readonly ChangedEntry[], config: Config, context: string): StagingPlan {
  const listed = entries.filter(({ path }) => !path.startsWith(KIT_FILES));
  const working = workingNumbers(listed);

  const inSlice = (entry: ChangedEntry): boolean =>
    entry.path.startsWith(`${config.contextsDir}/${context}/`) ||
    END_TO_END_SPEC.test(entry.path) ||
    ACCEPTANCE_SPEC.test(entry.path) ||
    isWorkingMigration(entry.path, working) ||
    (entry.tracked && isDerived(entry.path, config));

  return {
    toStage: listed.filter(inSlice).map(({ path }) => path),
    leftOut: listed.filter((entry) => !inSlice(entry)).map(({ path }) => path),
  };
}

function workingNumbers(entries: readonly ChangedEntry[]): Set<string> {
  return new Set(entries.flatMap(({ path }) => WORKING_MIGRATION.exec(path)?.[1] ?? []));
}

/** The working migration, then its drizzle-kit snapshot (same number) and the journal, when there is one. */
function isWorkingMigration(path: string, working: ReadonlySet<string>): boolean {
  if (WORKING_MIGRATION.test(path)) {
    return true;
  }

  const snapshot = /(?:^|\/)migrations\/meta\/(\d+)_snapshot\.json$/.exec(path)?.[1];

  return (
    working.size > 0 &&
    (snapshot !== undefined ? working.has(snapshot) : /(?:^|\/)migrations\/meta\/_journal\.json$/.test(path))
  );
}
