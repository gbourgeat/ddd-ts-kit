import { isRecord } from '../config/values/is-record.js';

/** The merged lock, or the versions both sides recorded with another shape, as `<event> v<version>`. */
export type LockMerge = { readonly text: string } | { readonly conflicts: readonly string[] };

type Lock = Record<string, Record<string, string>>;

/**
 * Merges the stored-events lock of both sides: every version either side recorded, since a
 * recorded version is never removed. A version both recorded with another shape is a stored
 * shape the merge cannot choose: it is left to a person. Written sorted, as `docs --stored-events` does.
 */
export function mergeStoredEventsLock(ours: string, theirs: string): LockMerge {
  const [mine, other] = [lockOf(ours), lockOf(theirs)];

  if (mine === undefined || other === undefined) {
    return { conflicts: ['a side that is not a JSON object'] };
  }

  const merged: Lock = {};
  const conflicts: string[] = [];

  for (const [event, versions] of [...Object.entries(mine), ...Object.entries(other)]) {
    for (const [version, shape] of Object.entries(versions)) {
      const recorded = merged[event]?.[version];

      if (recorded !== undefined && recorded !== shape) {
        conflicts.push(`${event} v${version}`);
      }

      merged[event] = { ...merged[event], [version]: recorded ?? shape };
    }
  }

  return conflicts.length > 0 ? { conflicts } : { text: `${JSON.stringify(sorted(merged), null, 2)}\n` };
}

function lockOf(text: string): Lock | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).map(([event, versions]) => [
            event,
            Object.fromEntries(
              Object.entries(isRecord(versions) ? versions : {}).map(([key, value]) => [
                key,
                typeof value === 'string' ? value : JSON.stringify(value),
              ]),
            ),
          ]),
        )
      : undefined;
  } catch {
    return undefined;
  }
}

function sorted(lock: Lock): Lock {
  return Object.fromEntries(
    Object.keys(lock)
      .sort()
      .map((event) => [
        event,
        Object.fromEntries(Object.entries(lock[event] ?? {}).sort(([left], [right]) => Number(left) - Number(right))),
      ]),
  );
}
