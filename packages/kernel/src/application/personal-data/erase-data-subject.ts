import type { DataSubjectErasure } from './data-subject-erasure';
import type { DataSubjectErasureReport } from './data-subject-erasure-report';
import type { SubjectKeyStore } from '../ports/subject-key-store';
import { isDataSubjectId } from './is-data-subject-id';
import { NotADataSubjectIdError } from './not-a-data-subject-id-error';
import type { ProjectionToRebuild } from './projection-to-rebuild';
import { UnknownDataSubjectError } from './unknown-data-subject-error';

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
 * with, so the stored events and snapshots read them as erased; erases every copy a context keeps
 * of the person in clear, in every tenant; then rebuilds every projection fed by the store, so no
 * read model keeps a clear copy. The copies and the rebuilds run even when the subject had no key
 * left, and even when the erasure of the key failed, since the key may be gone all the same (an
 * audit entry that could not be written): the first failure is thrown once they are done, and
 * running the erasure again completes it. Only a mistyped id skips the rebuilds. A subject that is
 * not an opaque identifier is refused before any key is touched: the audited keys write the
 * subject into the append-only trail, which never holds a name or an email. Give it the keys
 * wrapped by `auditedSubjectKeys` and the copies wrapped by `auditedPersonalDataErasure` of
 * `@ddd-ts-kit/audit`, so that every erasure leaves a dated proof of who asked for it; a project that
 * seals nothing (its aggregates are rows) gives no keys, and its copies are that proof.
 */
export async function eraseDataSubject(subject: string, parts: DataSubjectErasure): Promise<DataSubjectErasureReport> {
  if (!isDataSubjectId(subject)) {
    throw new NotADataSubjectIdError();
  }

  const [erasure] = await Promise.allSettled([eraseKeyOf(subject, parts.keys)]);
  const copies = await eraseCopies(subject, parts);

  if (await isMistyped(subject, { erasure, copies }, parts.isKnown)) {
    throw new UnknownDataSubjectError(subject);
  }

  const rebuilt = await rebuildAll(parts.rebuilds ?? []);

  throwFirstFailure({ erasure, copies });

  return { erased: erasure.status === 'fulfilled' && erasure.value, copies: copies.reached, rebuilt };
}

/** The key of the subject, when there is a store of keys at all: without one, no key was destroyed. */
function eraseKeyOf(subject: string, keys: SubjectKeyStore | undefined): Promise<boolean> {
  return keys === undefined ? Promise.resolve(false) : keys.erase(subject);
}

/** Every copy, in every tenant, one after the other: a copy that fails does not stop the next, and is thrown once everything ran. */
async function eraseCopies(subject: string, parts: DataSubjectErasure): Promise<ErasedCopies> {
  const { copies = [], inEveryTenant = (work) => work() } = parts;
  const reached: Record<string, number> = {};
  const failures: unknown[] = [];

  for (const copy of copies) {
    try {
      reached[copy.name] = await inEveryTenant(() => copy.erase(subject));
    } catch (error) {
      reached[copy.name] = 0;
      failures.push(error);
    }
  }

  return { reached, failures };
}

/** No key was destroyed, no copy was erased, nothing failed, and nobody knows the subject: not a run again, a mistyped id. */
async function isMistyped(
  subject: string,
  { erasure, copies }: Outcome,
  isKnown: DataSubjectErasure['isKnown'],
): Promise<boolean> {
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

async function rebuildAll(projections: readonly ProjectionToRebuild[]): Promise<Record<string, number>> {
  const rebuilt: Record<string, number> = {};

  for (const projection of projections) {
    rebuilt[projection.name] = (await projection.rebuild()).replayed;
  }

  return rebuilt;
}
