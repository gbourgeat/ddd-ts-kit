import { BLOCKED, realPathOf } from './real-path-of';

/** The real path of the root of a project, resolved once for every file of a plan; undefined when it cannot be read. */
export function realRootOf(root: string): string | undefined {
  const real = realPathOf(root);

  return real === BLOCKED ? undefined : real;
}
