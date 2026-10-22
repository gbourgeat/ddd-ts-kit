import type { SubjectKeyStore } from '@ddd-ts-kit/kernel';
import { isSubjectId } from '@/platform/events/is-subject-id';
import { NotASubjectIdError } from '@/platform/events/not-a-subject-id-error';
import type { StoreFedProjection } from '@/platform/events/store-fed-projections';
import { UnknownDataSubjectError } from '@/platform/events/unknown-data-subject-error';

export interface ErasureParts {
  readonly keys: SubjectKeyStore;
  readonly projections: readonly StoreFedProjection[];
  /**
   * Whether the subject exists at all, asked only when no key was destroyed: an id that
   * destroys no key and that nobody knows is a mistyped one, refused before the rebuilds; one
   * that somebody knows is a run again. Left out, every id is taken as known. A subject with a
   * key is erased whether anybody still knows it or not: the key comes first, the record after.
   */
  readonly isKnown?: (subject: string) => Promise<boolean>;
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
 * done, and running the erasure again completes it. Only a mistyped id skips them. A subject
 * that is not an opaque identifier is refused before any key is touched: the audited keys
 * write the subject into the append-only trail, which never holds a name or an email.
 */
export async function eraseDataSubject(
  subject: string,
  { keys, projections, isKnown }: ErasureParts,
): Promise<ErasureReport> {
  if (!isSubjectId(subject)) {
    throw new NotASubjectIdError();
  }

  const [erasure] = await Promise.allSettled([keys.erase(subject)]);

  if (await isMistyped(subject, erasure, isKnown)) {
    throw new UnknownDataSubjectError(subject);
  }

  const rebuilt = await rebuildAll(projections);

  if (erasure.status === 'rejected') {
    throw erasure.reason;
  }

  return { erased: erasure.value, rebuilt };
}

/** No key was destroyed, and nobody knows the subject: not a run again, a mistyped id. */
async function isMistyped(
  subject: string,
  erasure: PromiseSettledResult<boolean>,
  isKnown: ErasureParts['isKnown'],
): Promise<boolean> {
  if (erasure.status === 'rejected' || erasure.value || isKnown === undefined) {
    return false;
  }

  return !(await isKnown(subject));
}

async function rebuildAll(projections: readonly StoreFedProjection[]): Promise<Record<string, number>> {
  const rebuilt: Record<string, number> = {};

  for (const projection of projections) {
    rebuilt[projection.name] = (await projection.rebuild()).replayed;
  }

  return rebuilt;
}
