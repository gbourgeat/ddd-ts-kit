import type { PayloadIssue } from './payload-issue';

/** Why an event is not an erasure of version 1: the shape `@ddd-ts-kit/events` reports for any definition. */
export type DataSubjectErasedParseError =
  | { readonly reason: 'type-mismatch'; readonly expected: string; readonly actual: string }
  | { readonly reason: 'version-mismatch'; readonly expected: number; readonly actual: number }
  | { readonly reason: 'invalid-payload'; readonly issues: readonly PayloadIssue[] };
