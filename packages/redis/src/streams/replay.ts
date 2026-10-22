import type { Redis } from 'ioredis';
import { entriesOf } from './codec/entries-of';
import { replayFields } from './codec/replay-fields';

export interface Replay {
  readonly stream: string;
  readonly deadStream: string;
  readonly consumer: string;
  readonly limit: number;
}

/**
 * Appends a dead entry to its stream again and deletes it from the dead stream, unless
 * another replay took it meanwhile. KEYS: dead stream, stream. ARGV: dead entry id, then the
 * fields of the new entry.
 */
const REPLAY = `
if #redis.call('XRANGE', KEYS[1], ARGV[1], ARGV[1]) == 0 then
  return 0
end
redis.call('XADD', KEYS[2], '*', unpack(ARGV, 2))
return redis.call('XDEL', KEYS[1], ARGV[1])`;

/**
 * Moves up to `limit` dead entries back, oldest first, and answers how many. The new entry
 * names the consumer it is for: the other groups of the stream acknowledge it unseen.
 */
export async function replay(client: Redis, { stream, deadStream, consumer, limit }: Replay): Promise<number> {
  const dead = entriesOf(await client.xrange(deadStream, '-', '+', 'COUNT', limit));
  let replayed = 0;

  for (const entry of dead) {
    replayed += Number(await client.eval(REPLAY, 2, deadStream, stream, entry.id, ...replayFields(entry, consumer)));
  }

  return replayed;
}
