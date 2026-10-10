import type { ValidationIssue } from '@ddd-ts-kit/validation';

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly issues?: readonly ValidationIssue[];
  readonly requestId: string;
}
