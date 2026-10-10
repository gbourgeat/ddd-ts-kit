import type { ValidationIssue } from '@ddd-ts-kit/validation';

export class InvalidEventPayloadError extends Error {
  readonly code = 'INVALID_EVENT_PAYLOAD';

  readonly eventType: string;

  readonly eventVersion: number;

  readonly issues: readonly ValidationIssue[];

  constructor(eventType: string, eventVersion: number, issues: readonly ValidationIssue[]) {
    // Paths and codes only: issue messages may quote the offending data.
    const summary = issues.map((issue) => `${issue.path || '(payload)'}: ${issue.code}`).join(', ');

    super(`Invalid payload for ${eventType} v${eventVersion} (${summary})`);
    this.name = 'InvalidEventPayloadError';
    this.eventType = eventType;
    this.eventVersion = eventVersion;
    this.issues = issues;
  }
}
