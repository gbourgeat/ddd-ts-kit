import type { Logger } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { LoggedLine } from './logged-line';

export interface LoggerUnderContract {
  readonly logger: Logger;
  /** What reached the sink so far, in order. The suite awaits `logger.flush()` before it reads what was written late. */
  lines(): Awaitable<readonly LoggedLine[]>;
}
