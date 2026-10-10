import type { Redis } from 'ioredis';
import { entriesOf, fieldsWith, replayFields, type Entry } from './codec.js';

export interface DeadLetter {
  /** The stream the entry was read from, and the group it is pending in. */
  readonly stream: string;
  readonly group: string;
  readonly deadStream: string;
  readonly entry: Entry;
  /** Why it died, as fields added to the copy: codes only. */
  readonly annotations: Readonly<Record<string, string>>;
}

export interface Replay {
  readonly stream: string;
  readonly deadStream: string;
  readonly consumer: string;
  readonly limit: number;
}

/**
 * Copies the entry to the dead stream, then acknowledges it. A script, not a `MULTI`: a
 * transaction would acknowledge even if the copy failed. KEYS: dead stream, stream.
 * ARGV: group, entry id, then the fields of the copy.
 */
const BURY = `
redis.call('XADD', KEYS[1], '*', unpack(ARGV, 3))
return redis.call('XACK', KEYS[2], ARGV[1], ARGV[2])`;

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

export async function bury(client: Redis, letter: DeadLetter): Promise<void> {
  const { stream, group, deadStream, entry } = letter;
  await client.eval(BURY, 2, deadStream, stream, group, entry.id, ...fieldsWith(entry, letter.annotations));
}

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
