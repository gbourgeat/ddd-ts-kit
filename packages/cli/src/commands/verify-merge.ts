import { formatMergeVerification } from '../merge/lost/format-merge-verification';
import { verifyMerges } from '../merge/lost/verify-merges';
import { Arguments } from './arguments';
import type { Command } from './command';
import { stdoutJson } from '../json/stdout-json';

/** What `--warn` adds under the findings, while the check reaches projects as a warning first. */
const WARN_ONLY_NOTE =
  'warning only (--warn): what a merge lost does not block yet, a later minor version makes it block the push; `npx ddd-ts-kit verify-merge` alone exits 1 on it.';

/**
 * Reports what the merges of a branch lost: the lines one side added and the result dropped,
 * the rows no longer done, the tests, specs and migrations gone, the conflict markers left.
 * Then the migrations of the branch that do not follow the trunk's: one that sorts before its
 * last migration, one the journal of drizzle-kit does not list. Exits 1 on an error; `--warn`
 * (the same report, as the pre-push hook runs it) exits 0 on what a merge lost, and still 1 on
 * a migration out of order. Silent and 0 with nothing to say.
 */
export const verifyMergeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    since: { type: 'string' },
    theirs: { type: 'string' },
    base: { type: 'string' },
    warn: { type: 'boolean', default: false },
  });

  const [commit] = args.positionals;

  const verification = verifyMerges({
    root: args.projectRoot,
    ...(commit === undefined ? {} : { commit }),
    ...args.texts(['since', 'theirs', 'base']),
  });

  const warnOnly = args.flag('warn');
  const report = args.json ? stdoutJson(verification) : formatMergeVerification(verification);
  const softened = verification.errorCount > verification.migrations.length;
  const note = warnOnly && !args.json && softened ? `\n${WARN_ONLY_NOTE}` : '';

  if (report !== '') {
    io.out(`${report}${note}`);
  }

  return verification.ok || (warnOnly && verification.migrations.length === 0) ? 0 : 1;
};
