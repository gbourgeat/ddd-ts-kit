import type { SubjectKeyStore } from '@ddd-ts-kit/kernel';
import type { ErasureStep } from '@/platform/erasure/erasure-step';
import { isSubjectId } from '@/platform/erasure/is-subject-id';
import { NotASubjectIdError } from '@/platform/erasure/not-a-subject-id-error';
import type { StoreFedProjection } from '@/platform/event-store/store-fed-projections';
import { UnknownDataSubjectError } from '@/platform/erasure/unknown-data-subject-error';

export interface ErasureParts {
  readonly keys: SubjectKeyStore;
  readonly projections: readonly StoreFedProjection[];
  /** The copies the contexts keep of a data subject in clear, erased after the key, in every network. None: the key and the rebuilds alone. */
  readonly copies?: readonly ErasureStep[];
  /**
   * Runs a step once per network, in an execution context of that network, and sums what it
   * erased: a step writes tenant data, which no elevation widens. Left out, a step runs once, in
   * the current context.
   */
  readonly inEveryNetwork?: (work: () => Promise<number>) => Promise<number>;
  /**
   * Whether the subject exists at all, asked only when no key was destroyed and no copy erased:
   * an id that destroys no key, erases nothing and that nobody knows is a mistyped one, refused
   * before the rebuilds; one that somebody knows is a run again. Left out, every id is taken as
   * known. A subject with a key is erased whether anybody still knows it or not: the key comes
   * first, the record after.
   */
  readonly isKnown?: (subject: string) => Promise<boolean>;
}

/** What an erasure did: whether the subject had a key, the rows each copy reached in every network, and the events each projection replayed. */
export interface ErasureReport {
  readonly erased: boolean;
  readonly copies: Readonly<Record<string, number>>;
  readonly rebuilt: Readonly<Record<string, number>>;
}

interface ErasedCopies {
  readonly reached: Readonly<Record<string, number>>;
  readonly failures: readonly unknown[];
}

interface Outcome {
  readonly erasure: PromiseSettledResult<boolean>;
  readonly copies: ErasedCopies;
}

/**
 * The right to erasure of one data subject: destroys the key its personal values were sealed
 * with, so the events and snapshots read them as erased; erases every copy a context keeps of the
 * person in clear, in every network; then rebuilds every projection fed by the store, so no read
 * model keeps a clear copy. The copies and the rebuilds run even when the subject had no key
 * left, and even when the erasure of the key failed, since the key may be gone all the same (an
 * audit entry that could not be written): the first failure is thrown once they are done, and
 * running the erasure again completes it. Only a mistyped id skips the rebuilds. A subject that is
 * not an opaque identifier is refused before any key is touched: the audited keys write the
 * subject into the append-only trail, which never holds a name or an email.
 */
export async function eraseDataSubject(subject: string, parts: ErasureParts): Promise<ErasureReport> {
  if (!isSubjectId(subject)) {
    throw new NotASubjectIdError();
  }

  const [erasure] = await Promise.allSettled([parts.keys.erase(subject)]);
  const copies = await eraseCopies(subject, parts);

  if (await isMistyped(subject, { erasure, copies }, parts.isKnown)) {
    throw new UnknownDataSubjectError(subject);
  }

  const rebuilt = await rebuildAll(parts.projections);

  throwFirstFailure({ erasure, copies });

  return { erased: erasure.status === 'fulfilled' && erasure.value, copies: copies.reached, rebuilt };
}

/** Every step, in every network, one after the other: a step that fails does not stop the next, and is thrown once everything ran. */
async function eraseCopies(subject: string, parts: ErasureParts): Promise<ErasedCopies> {
  const { copies = [], inEveryNetwork = (work) => work() } = parts;
  const reached: Record<string, number> = {};
  const failures: unknown[] = [];

  for (const step of copies) {
    try {
      reached[step.name] = await inEveryNetwork(() => step.erase(subject));
    } catch (error) {
      reached[step.name] = 0;
      failures.push(error);
    }
  }

  return { reached, failures };
}

/** No key was destroyed, no copy was erased, nothing failed, and nobody knows the subject: not a run again, a mistyped id. */
async function isMistyped(subject: string, { erasure, copies }: Outcome, isKnown: ErasureParts['isKnown']) {
  if (erasure.status === 'rejected' || erasure.value || copies.failures.length > 0 || isKnown === undefined) {
    return false;
  }

  if (Object.values(copies.reached).some((rows) => rows > 0)) {
    return false;
  }

  return !(await isKnown(subject));
}

function throwFirstFailure({ erasure, copies }: Outcome): void {
  if (erasure.status === 'rejected') {
    throw erasure.reason;
  }

  if (copies.failures.length > 0) {
    throw copies.failures[0];
  }
}

async function rebuildAll(projections: readonly StoreFedProjection[]): Promise<Record<string, number>> {
  const rebuilt: Record<string, number> = {};

  for (const projection of projections) {
    rebuilt[projection.name] = (await projection.rebuild()).replayed;
  }

  return rebuilt;
}
