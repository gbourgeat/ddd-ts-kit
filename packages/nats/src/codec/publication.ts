import type { MsgHdrs } from '@nats-io/transport-node';

export interface Publication {
  readonly data: string | Uint8Array;
  readonly messageId: string;
  readonly headers: MsgHdrs;
}
