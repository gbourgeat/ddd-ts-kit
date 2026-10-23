import type { Reply } from './reply';

const CRLF = '\r\n';

/**
 * Reads the commands a client sends: arrays of bulk strings, or an inline command on one line.
 * Fed chunk after chunk, it hands each complete command over and keeps the rest for the next chunk.
 */
export class CommandReader {
  private buffer = Buffer.alloc(0);

  constructor(private readonly onCommand: (command: string[]) => void) {}

  feed(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    for (;;) {
      const read = this.command();

      if (read === undefined) {
        return;
      }

      this.buffer = this.buffer.subarray(read.end);

      if (read.command.length > 0) {
        this.onCommand(read.command);
      }
    }
  }

  private command(): { readonly command: string[]; readonly end: number } | undefined {
    const line = this.line(0);

    if (line === undefined) {
      return undefined;
    }

    if (!line.text.startsWith('*')) {
      return { command: line.text.split(' ').filter((part) => part !== ''), end: line.end };
    }

    const command: string[] = [];
    let offset = line.end;

    for (let index = 0; index < Number(line.text.slice(1)); index += 1) {
      const header = this.line(offset);

      if (header === undefined) {
        return undefined;
      }

      const length = Number(header.text.slice(1));

      if (this.buffer.length < header.end + length + 2) {
        return undefined;
      }

      command.push(this.buffer.toString('utf8', header.end, header.end + length));
      offset = header.end + length + 2;
    }

    return { command, end: offset };
  }

  private line(from: number): { readonly text: string; readonly end: number } | undefined {
    const end = this.buffer.indexOf(CRLF, from);

    return end === -1 ? undefined : { text: this.buffer.toString('utf8', from, end), end: end + 2 };
  }
}

/** A reply in the protocol the client chose with `HELLO`: RESP2 by default, RESP3 after `HELLO 3`. */
export function encode(reply: Reply, protocol: 2 | 3): string {
  switch (reply.kind) {
    case 'status':
      return `+${reply.text}${CRLF}`;
    case 'error':
      return `-${reply.text}${CRLF}`;
    case 'integer':
      return `:${String(reply.value)}${CRLF}`;
    case 'bulk':
      return reply.value === null
        ? nil(protocol)
        : `$${String(Buffer.byteLength(reply.value))}${CRLF}${reply.value}${CRLF}`;
    case 'text':
      return protocol === 3
        ? `=${String(Buffer.byteLength(reply.value) + 4)}${CRLF}txt:${reply.value}${CRLF}`
        : `$${String(Buffer.byteLength(reply.value))}${CRLF}${reply.value}${CRLF}`;
    case 'array':
      return reply.items === null
        ? protocol === 3
          ? `_${CRLF}`
          : `*-1${CRLF}`
        : aggregate('*', reply.items, protocol);
    case 'push':
      return aggregate(protocol === 3 ? '>' : '*', reply.items, protocol);
    case 'map':
      return protocol === 3
        ? `%${String(reply.entries.length)}${CRLF}${reply.entries.map(([key, value]) => encode({ kind: 'bulk', value: key }, protocol) + encode(value, protocol)).join('')}`
        : aggregate(
            '*',
            reply.entries.flatMap(([key, value]) => [{ kind: 'bulk', value: key } as const, value]),
            protocol,
          );
  }
}

function aggregate(type: string, items: readonly Reply[], protocol: 2 | 3): string {
  return `${type}${String(items.length)}${CRLF}${items.map((item) => encode(item, protocol)).join('')}`;
}

function nil(protocol: 2 | 3): string {
  return protocol === 3 ? `_${CRLF}` : `$-1${CRLF}`;
}
