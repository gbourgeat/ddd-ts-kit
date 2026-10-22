import { headers as emptyHeaders, type MsgHdrs } from '@nats-io/transport-node';
import { MESSAGE_ID_HEADER } from './headers';
import type { Publication } from './publication';

export interface Republished {
  readonly data: Uint8Array;
  readonly headers: MsgHdrs | undefined;
  /** Unique for this copy: the stream must not take it for a duplicate of the original. */
  readonly messageId: string;
}

/** The same message, for another subject, with `added` headers set or replaced. */
export function republication(message: Republished, added: Record<string, string>): Publication {
  const headers = emptyHeaders();

  for (const [name, values] of message.headers ?? []) {
    for (const value of name === MESSAGE_ID_HEADER ? [] : values) {
      headers.append(name, value);
    }
  }

  for (const [name, value] of Object.entries(added)) {
    headers.set(name, value);
  }

  return { data: message.data, messageId: message.messageId, headers };
}
