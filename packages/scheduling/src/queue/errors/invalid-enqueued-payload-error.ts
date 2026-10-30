import type { PayloadIssue } from '@ddd-ts-kit/kernel';
import { faultsOf, type PayloadFault } from './faults-of';

/**
 * A payload the schema of its job refuses, where it is enqueued: nothing is stored, and the
 * caller learns it before its unit of work commits, instead of a worker finding the job dead
 * later. It carries the path and the code of each issue, never their message.
 */
export class InvalidEnqueuedPayloadError extends Error {
  readonly code = 'INVALID_ENQUEUED_PAYLOAD';

  readonly job: string;

  readonly issues: readonly PayloadFault[];

  constructor(job: string, issues: readonly PayloadIssue[]) {
    const faults = faultsOf(issues);
    const summary = faults.map((fault) => `${fault.path || '(payload)'}: ${fault.code}`).join(', ');

    super(`Background job "${job}" cannot be enqueued: its payload does not fit its schema (${summary}).`);
    this.name = 'InvalidEnqueuedPayloadError';
    this.job = job;
    this.issues = faults;
  }
}
