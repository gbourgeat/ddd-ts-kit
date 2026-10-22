import type { SubjectKeyStore } from '@ddd-ts-kit/kernel';
import type { StoreFedProjection } from '@/platform/events/store-fed-projections';

export interface ErasureParts {
  readonly keys: SubjectKeyStore;
  readonly projections: readonly StoreFedProjection[];
}

/** What an erasure did: whether the subject had a key, and the events each projection replayed. */
export interface ErasureReport {
  readonly erased: boolean;
  readonly rebuilt: Readonly<Record<string, number>>;
}

/**
 * The right to erasure of one data subject (crypto-shredding): destroys the key its personal
 * values were sealed with, so the events and snapshots read them as erased, then rebuilds every
 * projection fed by the store, so no read model keeps a clear copy. The rebuilds run even when
 * the subject had no key left, and even when the erasure failed, since the key may be gone all
 * the same (an audit entry that could not be written): that failure is thrown once they are
 * done, and running the erasure again completes it.
 */
export async function eraseDataSubject(subject: string, { keys, projections }: ErasureParts): Promise<ErasureReport> {
  const [erasure] = await Promise.allSettled([keys.erase(subject)]);
  const rebuilt = await rebuildAll(projections);

  if (erasure.status === 'rejected') {
    throw erasure.reason;
  }

  return { erased: erasure.value, rebuilt };
}

async function rebuildAll(projections: readonly StoreFedProjection[]): Promise<Record<string, number>> {
  const rebuilt: Record<string, number> = {};

  for (const projection of projections) {
    rebuilt[projection.name] = (await projection.rebuild()).replayed;
  }

  return rebuilt;
}
