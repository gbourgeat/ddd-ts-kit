import { formatMergeVerification } from '../merge/lost/format-merge-verification';
import { verifyMerges } from '../merge/lost/verify-merges';
import { Arguments } from './arguments';
import type { Command } from './command';

/** What `--warn` adds under the findings, while the check reaches projects as a warning first. */
const WARN_ONLY_NOTE =
  'warning only (--warn): these errors do not block yet, a later minor version makes them block the push; `npx ddd-ts-kit verify-merge` alone exits 1 on them.';

/**
 * Reports what the merges of a branch lost: the lines one side added and the result dropped,
 * the rows no longer done, the tests, specs and migrations gone, the conflict markers left.
 * Exits 1 on an error, 0 with `--warn` (the same report, as the pre-push hook runs it); silent
 * and 0 without a merge to check.
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
  const report = args.json ? JSON.stringify(verification, null, 2) : formatMergeVerification(verification);
  const note = warnOnly && !args.json && !verification.ok ? `\n${WARN_ONLY_NOTE}` : '';

  if (report !== '') {
    io.out(`${report}${note}`);
  }

  return verification.ok || warnOnly ? 0 : 1;
};
