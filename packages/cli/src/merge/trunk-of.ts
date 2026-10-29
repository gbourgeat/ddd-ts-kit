import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { commitOf } from '../commit/commit-of';
import { knownCommit } from '../commit/known-commit';

const TRUNKS = ['origin/HEAD', 'origin/main'];
const FIX = 'Fetch it first (`git fetch origin`), or name the trunk: `--trunk <ref>`.';

/**
 * The trunk to bring in: `--trunk`, else origin/HEAD (named by the branch it points to), else
 * origin/main. Nothing is fetched: the commit is the one the ref names now.
 */
export function trunkOf(top: string, explicit: string | undefined): { ref: string; commit: string } {
  if (explicit !== undefined) {
    return { ref: explicit, commit: knownCommit(top, explicit, FIX) };
  }

  for (const ref of TRUNKS) {
    const commit = commitOf(top, ref);

    if (commit !== undefined) {
      const named = ref === 'origin/HEAD' ? runGit(top, ['rev-parse', '--abbrev-ref', ref])?.trim() : undefined;

      return { ref: named || ref, commit };
    }
  }

  throw new CliError('No trunk to bring in: neither origin/HEAD nor origin/main names a commit.', FIX);
}
