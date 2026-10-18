import { runGit } from '../commit/run-git.js';

/**
 * The remote branch of the trunk when the current branch is the trunk (the branch origin/HEAD
 * names, else main or master) and follows it: `origin/main` for `main`, what a fetch brings up to
 * date while the local branch stays behind until it is pulled. Any other branch, pushed or not,
 * is its own base: its remote copy may lack what was just committed.
 */
export function upstreamOf(root: string): string | undefined {
  const current = runGit(root, ['branch', '--show-current'])?.trim() ?? '';
  const upstream = runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])?.trim();

  return trunkNames(root).includes(current) && upstream !== '' ? upstream : undefined;
}

/** The names the trunk goes by: the branch origin/HEAD points to, else main and master. */
function trunkNames(root: string): string[] {
  const named = runGit(root, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])?.trim() ?? '';

  return named.startsWith('origin/') && named !== 'origin/HEAD' ? [named.slice('origin/'.length)] : ['main', 'master'];
}
