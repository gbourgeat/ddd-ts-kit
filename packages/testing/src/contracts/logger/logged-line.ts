import type { LogLevel } from '@ddd-ts-kit/kernel';

/** One entry as the sink received it, whatever the format of the adapter. */
export interface LoggedLine {
  readonly level: LogLevel;
  readonly message: string;
  /** Everything else of the entry. Keys the adapter adds by itself (time, service) are ignored. */
  readonly fields: Readonly<Record<string, unknown>>;
}
