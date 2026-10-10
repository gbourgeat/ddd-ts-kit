import type { IncomingRecord } from './incoming-record.js';

/** Where a record sits in the log: `<topic>/<partition>/<offset>`. */
export function sourceOf({ topic, partition, message }: IncomingRecord): string {
  return `${topic}/${String(partition)}/${message.offset}`;
}
