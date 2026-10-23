import { AssertionError } from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
import {
  StoredEventData,
  isStoredData,
  isStoredList,
  storedDataOf,
  type DomainEvent,
  type StoredData,
  type StoredJson,
} from '@ddd-ts-kit/kernel';
import type { SnapshotEquivalence } from './snapshot-equivalence';

/**
 * Proves that the snapshots of an aggregate give the state a full replay gives. For every version
 * of the history, the aggregate replayed up to it is encoded as its snapshot policy would store it,
 * decoded, and rebuilt from that snapshot and the events after it: its state and its version must
 * equal those of the aggregate replayed from the first event. Throws an AssertionError at the
 * first version that differs. A personal value is read back as it was given, as a cipher would
 * open it.
 */
export function expectSnapshotEquivalence<A extends { readonly version: number }, E extends DomainEvent, S>(
  proof: SnapshotEquivalence<A, E, S>,
): void {
  const { events } = proof;
  const id = events[0]?.aggregateId ?? '';
  const replayed = proof.rehydrate(id, { events });

  for (let at = 1; at <= events.length; at += 1) {
    const restored = fromSnapshotAt(proof, id, at);

    if (restored.version !== replayed.version || !isDeepStrictEqual(proof.state(restored), proof.state(replayed))) {
      throw new AssertionError({
        message: `Rebuilt from a snapshot taken after event ${at} of ${events.length}, the aggregate differs from its full replay.`,
        actual: { version: restored.version, state: proof.state(restored) },
        expected: { version: replayed.version, state: proof.state(replayed) },
        operator: 'expectSnapshotEquivalence',
      });
    }
  }
}

function fromSnapshotAt<A extends { readonly version: number }, E extends DomainEvent, S>(
  proof: SnapshotEquivalence<A, E, S>,
  id: string,
  at: number,
): A {
  const { events, policy } = proof;
  const kept = opened(storedDataOf(policy.encode(proof.rehydrate(id, { events: events.slice(0, at) }))));
  const state = policy.decode(new StoredEventData(kept, `the snapshot after event ${at}`));

  return proof.rehydrate(id, { snapshot: { version: at, state }, events: events.slice(at) });
}

/** The data as a store would give it back: a copy, each personal value in place of its marker. */
function opened(data: StoredData): StoredData {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, openedValue(value)]));
}

function openedValue(value: StoredJson): StoredJson {
  if (isStoredList(value)) {
    return value.map(openedValue);
  }

  if (!isStoredData(value)) {
    return value;
  }

  const personal = value['$personal'];

  return isStoredData(personal) && typeof personal['value'] === 'string' ? personal['value'] : opened(value);
}
