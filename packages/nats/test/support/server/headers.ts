/**
 * The header block of a NATS message: `NATS/1.0`, a status for what the server says by itself
 * (`404 Message Not Found`, `100 Idle Heartbeat`), then one `Name: value` line per field.
 */
export interface HeaderBlock {
  readonly code: number;
  readonly description: string;
  readonly fields: readonly (readonly [string, string])[];
}

const VERSION = 'NATS/1.0';

export function encodeHeaders({ code, description, fields }: HeaderBlock): Buffer {
  const status = code === 0 ? VERSION : `${VERSION} ${String(code)}${description === '' ? '' : ` ${description}`}`;
  const lines = [status, ...fields.map(([name, value]) => `${name}: ${value}`)];

  return Buffer.from(`${lines.join('\r\n')}\r\n\r\n`);
}

export function decodeHeaders(block: Buffer | undefined): HeaderBlock {
  const [status = VERSION, ...lines] = (block?.toString('utf8') ?? '').split('\r\n').filter((line) => line !== '');
  const [, code = '0', ...description] = status.split(' ');

  const fields = lines.flatMap((line): (readonly [string, string])[] => {
    const colon = line.indexOf(':');

    return colon < 0 ? [] : [[line.slice(0, colon).trim(), line.slice(colon + 1).trim()]];
  });

  return { code: Number(code), description: description.join(' '), fields };
}

/** A message of the server itself, without a body: a status and its fields. */
export function statusHeaders(code: number, description: string, fields: HeaderBlock['fields'] = []): Buffer {
  return encodeHeaders({ code, description, fields });
}

export function headerOf(block: Buffer | undefined, name: string): string | undefined {
  const wanted = name.toLowerCase();

  return decodeHeaders(block).fields.find(([field]) => field.toLowerCase() === wanted)?.[1];
}
