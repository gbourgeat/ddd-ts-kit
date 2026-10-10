import type { LogFields, LogLevel } from '@ddd-ts-kit/kernel';

/** What the suite asks of the logger it is about to exercise. */
export interface LoggerContractSetup {
  /** Entries below it must not reach the sink. */
  readonly level: LogLevel;
  /** To be read at each entry that is written, and merged under the fields of the entry. */
  readonly fields: () => LogFields;
  /** Whether the message of an error that is not a `DomainError` must be replaced. */
  readonly scrubMessages: boolean;
}
