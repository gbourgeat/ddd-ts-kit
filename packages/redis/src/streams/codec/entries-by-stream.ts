import { listOf } from '../../replies/list-of';
import { entriesOf } from './entries-of';
import type { Entry } from './entry';

/** The reply of `XREADGROUP`: the entries read, stream by stream. Nothing to read is `null`. */
export function entriesByStream(reply: unknown): Map<string, Entry[]> {
  const read = new Map<string, Entry[]>();

  for (const answer of listOf(reply)) {
    const [stream, entries] = listOf(answer);

    if (typeof stream === 'string') {
      read.set(stream, entriesOf(entries));
    }
  }

  return read;
}
