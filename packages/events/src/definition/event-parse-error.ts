import type { ValidationIssue } from '@ddd-ts-kit/validation';

export type EventParseError =
  | { readonly reason: 'type-mismatch'; readonly expected: string; readonly actual: string }
  | { readonly reason: 'version-mismatch'; readonly expected: number; readonly actual: number }
  | { readonly reason: 'invalid-payload'; readonly issues: readonly ValidationIssue[] };
