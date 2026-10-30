import type { PayloadIssue } from '@ddd-ts-kit/kernel';

/** What does not fit in a payload, by its path and its code: never the message of the library, which may quote the data. */
export interface PayloadFault {
  readonly path: string;
  readonly code: string;
}

export function faultsOf(issues: readonly PayloadIssue[]): readonly PayloadFault[] {
  return issues.map(({ path, code }) => ({ path, code }));
}
