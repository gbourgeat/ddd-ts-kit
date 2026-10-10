import type { Entry } from './entry.js';
import {
  ATTEMPT_FIELD,
  CONSUMER_FIELD,
  DEAD_REASON_FIELD,
  ENTRY_ID_FIELD,
  ERROR_CODE_FIELD,
  REPLAY_FOR_FIELD,
} from './entry-fields.js';

const DEAD_LETTER_FIELDS: ReadonlySet<string> = new Set([
  ERROR_CODE_FIELD,
  DEAD_REASON_FIELD,
  ATTEMPT_FIELD,
  CONSUMER_FIELD,
  ENTRY_ID_FIELD,
  REPLAY_FOR_FIELD,
]);

/** The fields of a dead entry as they were published, addressed to the consumer it died for. */
export function replayFields(dead: Entry, consumer: string): string[] {
  const published = [...dead.fields].filter(([name]) => !DEAD_LETTER_FIELDS.has(name));

  return [...published, [REPLAY_FOR_FIELD, consumer]].flat();
}
