import type { Keyspace } from '../keyspace';
import { CommandError, type Reply, array, bulk, bulks } from '../reply';
import type { Group, Stream, StreamEntry } from '../stream';

/** `[id, [field, value, ...]]`, an entry as XRANGE, XREADGROUP and XCLAIM answer it. */
export function entryReply(entry: StreamEntry): Reply {
  return array([bulk(entry.id.toString()), bulks(entry.fields)]);
}

export function entriesReply(entries: readonly StreamEntry[]): Reply {
  return array(entries.map(entryReply));
}

/** The stream and group a group command names, or the refusal Redis answers when one is missing. */
export function groupOf(
  keyspace: Keyspace,
  key: string,
  name: string,
  missing: string,
): { stream: Stream; group: Group } {
  const stream = keyspace.read(key, 'stream')?.stream;
  const group = stream?.groups.get(name);

  if (stream === undefined || group === undefined) {
    throw new CommandError(missing);
  }

  return { stream, group };
}

export function noGroup(key: string, group: string): string {
  return `NOGROUP No such key '${key}' or consumer group '${group}'`;
}
