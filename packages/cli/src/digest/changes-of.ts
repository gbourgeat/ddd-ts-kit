import type { Changed } from './digest';

/**
 * How the entries of HEAD differ from those of the base, matched by key: those added and those
 * changed in the order of HEAD, then those removed in the order of the base. An entry equal on
 * both sides is left out.
 */
export function changesOf<T>(before: readonly T[], after: readonly T[], keyOf: (entry: T) => string): Changed<T>[] {
  const was = new Map(before.map((entry) => [keyOf(entry), entry]));
  const kept = new Set(after.map(keyOf));

  return [
    ...after.flatMap((entry): Changed<T>[] => {
      const earlier = was.get(keyOf(entry));

      if (earlier === undefined) {
        return [{ ...entry, change: 'added' }];
      }

      return JSON.stringify(earlier) === JSON.stringify(entry) ? [] : [{ ...entry, change: 'changed' }];
    }),
    ...before.filter((entry) => !kept.has(keyOf(entry))).map((entry): Changed<T> => ({ ...entry, change: 'removed' })),
  ];
}
