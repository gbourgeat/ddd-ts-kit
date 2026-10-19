/** What a client sends, as the server reads it. CONNECT and what the server ignores read as `CONNECT`. */
export type ClientFrame =
  | { readonly op: 'CONNECT' }
  | { readonly op: 'PING' }
  | { readonly op: 'PONG' }
  | { readonly op: 'SUB'; readonly subject: string; readonly sid: string }
  | { readonly op: 'UNSUB'; readonly sid: string; readonly max: number | undefined }
  | {
      readonly op: 'PUB';
      readonly subject: string;
      readonly reply: string | undefined;
      readonly headers: Buffer | undefined;
      readonly data: Buffer;
    };

const CRLF = Buffer.from('\r\n');

/** Cuts the bytes of one client into frames; a frame cut by the network waits for its end. */
export class FrameReader {
  private pending = Buffer.alloc(0);

  read(chunk: Buffer): ClientFrame[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    const frames: ClientFrame[] = [];

    for (let frame = this.next(); frame !== undefined; frame = this.next()) {
      frames.push(frame);
    }

    return frames;
  }

  private next(): ClientFrame | undefined {
    const end = this.pending.indexOf(CRLF);

    if (end < 0) {
      return undefined;
    }

    const [verb = '', ...args] = this.pending
      .subarray(0, end)
      .toString('latin1')
      .split(' ')
      .filter((part) => part !== '');

    const op = verb.toUpperCase();

    if (op !== 'PUB' && op !== 'HPUB') {
      this.pending = this.pending.subarray(end + 2);

      return controlFrame(op, args);
    }

    const withHeaders = op === 'HPUB';
    const total = Number(args.at(-1));
    const start = end + 2;

    if (this.pending.length < start + total + 2) {
      return undefined;
    }

    const body = Buffer.from(this.pending.subarray(start, start + total));
    const headerSize = withHeaders ? Number(args.at(-2)) : 0;
    const [subject = '', reply] = args.slice(0, withHeaders ? -2 : -1);

    this.pending = this.pending.subarray(start + total + 2);

    return {
      op: 'PUB',
      subject,
      reply,
      headers: withHeaders ? body.subarray(0, headerSize) : undefined,
      data: body.subarray(headerSize),
    };
  }
}

/** `MSG` for a message without headers, `HMSG` with: what the server writes to a subscription. */
export function messageFrame(
  subject: string,
  sid: string,
  reply: string | undefined,
  headers: Buffer | undefined,
  data: Buffer,
): Buffer {
  const replyTo = reply === undefined ? '' : ` ${reply}`;

  if (headers === undefined) {
    return Buffer.concat([Buffer.from(`MSG ${subject} ${sid}${replyTo} ${String(data.length)}\r\n`), data, CRLF]);
  }

  const sizes = `${String(headers.length)} ${String(headers.length + data.length)}`;

  return Buffer.concat([Buffer.from(`HMSG ${subject} ${sid}${replyTo} ${sizes}\r\n`), headers, data, CRLF]);
}

function controlFrame(op: string, args: readonly string[]): ClientFrame {
  switch (op) {
    case 'PING':
      return { op: 'PING' };
    case 'PONG':
      return { op: 'PONG' };
    case 'SUB':
      // SUB <subject> [queue group] <sid>: a queue group shares nothing here, one client per subscription.
      return { op: 'SUB', subject: args[0] ?? '', sid: args.at(-1) ?? '' };
    case 'UNSUB':
      return { op: 'UNSUB', sid: args[0] ?? '', max: args[1] === undefined ? undefined : Number(args[1]) };
    default:
      return { op: 'CONNECT' };
  }
}
