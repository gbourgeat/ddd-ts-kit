import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { commitOf } from '../commit/commit-of';

const TRUNKS = ['origin/HEAD', 'origin/main'];

/**
 * The trunk to bring in: `--trunk`, else origin/HEAD (named by the branch it points to), else
 * origin/main. Nothing is fetched: the commit is the one the ref names now.
 */
export function trunkOf(top: string, explicit: string | undefined): { ref: string; commit: string } {
  for (const ref of explicit === undefined ? TRUNKS : [explicit]) {
    const commit = commitOf(top, ref);

    if (commit !== undefined) {
      const named = ref === 'origin/HEAD' ? runGit(top, ['rev-parse', '--abbrev-ref', ref])?.trim() : undefined;

      return { ref: named || ref, commit };
    }
  }

  throw new CliError(
    explicit === undefined
      ? 'No trunk to bring in: neither origin/HEAD nor origin/main names a commit.'
      : `--trunk ${explicit} is not a commit of this repository.`,
    'Fetch it first (`git fetch origin`), or name the trunk: `--trunk <ref>`.',
  );
}
