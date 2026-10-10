import type { DomainEvent } from '../../domain/domain-event.js';

/** Told each failure of an `after-commit` handler, with the event it was handling. Never throws. */
export type AfterCommitFailure = (error: unknown, event: DomainEvent) => void;
