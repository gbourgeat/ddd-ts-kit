import { type CliResult, cli } from '../helpers';
import { expectOk } from './expect-ok';
import { git } from './git';

/** `init --force` on a project whose files are committed, as the kit asks before it rewrites one. */
export function forcedInit(root: string): CliResult {
  git(root, 'init', '--quiet', '--initial-branch', 'main');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--allow-empty', '--message', 'chore: as it stands');

  return expectOk(cli(root, 'init', '--force'));
}
