import type { PersonalDataCopy } from '@ddd-ts-kit/kernel';
import type { JobStore } from './job-store';

/**
 * The jobs enqueued for a person, `subject` naming them, as one more copy of that person, for
 * `shared` of `eraseDataSubject`: a job waiting for someone erased does not run with what its row
 * keeps. The store is not confined to a tenant, so it is erased once, not once per tenant.
 */
export function jobsOfSubject(store: JobStore): PersonalDataCopy {
  return { name: 'platform.background-jobs', erase: (subject) => store.eraseSubject(subject) };
}
