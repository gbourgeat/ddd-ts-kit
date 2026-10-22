import { runGit } from '../commit/run-git';

/**
 * What limits a judgement made at a ref: a shallow history, where a removed name looks planned,
 * and a local branch behind its upstream, whose names may be stale already.
 */
export function refNotes(root: string, ref: string): string[] {
  const shallow = runGit(root, ['rev-parse', '--is-shallow-repository'])?.trim() === 'true';

  return [
    ...(shallow
      ? [
          'history is shallow: a removed name cannot be told from a planned one (`git fetch --unshallow` reads it whole).',
        ]
      : []),
    ...behind(root, ref),
  ];
}

function behind(root: string, ref: string): string[] {
  const local = runGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${ref}`]) !== undefined;
  const upstream = local ? runGit(root, ['rev-parse', '--abbrev-ref', `${ref}@{upstream}`])?.trim() : undefined;

  const count =
    upstream === undefined ? 0 : Number(runGit(root, ['rev-list', '--count', `${ref}..${upstream}`])?.trim() ?? 0);

  return count > 0
    ? [
        `${ref} is ${count} commit${count === 1 ? '' : 's'} behind ${upstream}: the names were checked against ${ref}; fetch and pass --base ${upstream}.`,
      ]
    : [];
}
