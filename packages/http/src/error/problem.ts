import type { RefusalFacts } from '@ddd-ts-kit/kernel';
import type { ValidationIssue } from '@ddd-ts-kit/validation';

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly issues?: readonly ValidationIssue[];
  /** The facts the refusal exposes, by name. Absent when its factory exposed none: facts are private by default. */
  readonly facts?: RefusalFacts;
  readonly requestId: string;
}
