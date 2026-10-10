/**
 * Trimming applied by each publication, approximately (`~`). It drops the oldest entries
 * whether or not every consumer group has read them: an opt-in, never a default.
 */
export type RetentionOptions =
  | { /** Keep about this many entries per stream (`MAXLEN ~`). */ readonly maxLength: number }
  | { /** Keep the entries younger than this (`MINID ~`), by the clock of the publisher. */ readonly maxAgeMs: number };
