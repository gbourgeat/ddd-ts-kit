import type { RetentionOptions } from '../options/retention-options.js';

export interface StreamDescription {
  readonly name: string;

  /** `events` is published to and read by every group; `dead` keeps what one consumer gave up on. */
  readonly role: 'events' | 'dead';

  readonly type: string;

  /** The consumer a dead stream belongs to. */
  readonly consumer?: string;

  /** The trimming each publication applies to an events stream, when one is configured. */
  readonly retention?: RetentionOptions;
}
