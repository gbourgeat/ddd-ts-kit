import { once } from 'node:events';
import type { Writable } from 'node:stream';

/**
 * Writes the chunks of a streamed list to a response, waiting for the client when it reads slower
 * than the list is produced, and stops reading the list when the client leaves. A failure once
 * the status is sent can only cut the response short: the connection is closed.
 */
export async function writeStream(target: Writable, chunks: AsyncIterable<string>): Promise<void> {
  try {
    for await (const chunk of chunks) {
      if (target.destroyed) {
        return;
      }

      if (!target.write(chunk)) {
        await Promise.race([once(target, 'drain'), once(target, 'close')]);
      }
    }

    target.end();
  } catch (error) {
    target.destroy(error instanceof Error ? error : undefined);
  }
}
