import { commitOf } from './commit-of';

const TRUNK = 'origin/main';

/** `origin/main` where that ref resolves; undefined in a repository that has none (before its first push). */
export function resolvedTrunk(root: string): string | undefined {
  return commitOf(root, TRUNK) === undefined ? undefined : TRUNK;
}
