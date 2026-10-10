import type { Redis } from 'ioredis';
import type { Entry } from './codec/entry.js';
import { fieldsWith } from './codec/fields-with.js';

export interface DeadLetter {
  /** The stream the entry was read from, and the group it is pending in. */
  readonly stream: string;

  readonly group: string;

  readonly deadStream: string;

  readonly entry: Entry;

  /** Why it died, as fields added to the copy: codes only. */
  readonly annotations: Readonly<Record<string, string>>;
}

/**
 * Copies the entry to the dead stream, then acknowledges it. A script, not a `MULTI`: a
 * transaction would acknowledge even if the copy failed. KEYS: dead stream, stream.
 * ARGV: group, entry id, then the fields of the copy.
 */
const BURY = `
redis.call('XADD', KEYS[1], '*', unpack(ARGV, 3))
return redis.call('XACK', KEYS[2], ARGV[1], ARGV[2])`;

export async function bury(client: Redis, letter: DeadLetter): Promise<void> {
  const { stream, group, deadStream, entry } = letter;

  await client.eval(BURY, 2, deadStream, stream, group, entry.id, ...fieldsWith(entry, letter.annotations));
}
