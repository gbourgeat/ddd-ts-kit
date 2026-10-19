import type { ConsumeMessage, MessageProperties } from 'amqplib';
import type { MemoryChannel } from './memory-channel.js';
import type { Queue } from './queue.js';

export type Arguments = Readonly<Record<string, unknown>>;

export interface Binding {
  readonly queue: string;
  readonly pattern: string;
}

export interface Exchange {
  readonly name: string;
  readonly type: string;
  readonly durable: boolean;
  bindings: Binding[];
}

/** The exchange named `''`: it routes a message to the queue its routing key names. */
export const DEFAULT_EXCHANGE: Exchange = { name: '', type: 'direct', durable: true, bindings: [] };

export interface StoredMessage {
  readonly content: Buffer;
  readonly properties: MessageProperties;
  readonly exchange: string;
  readonly routingKey: string;
  readonly redelivered: boolean;
}

export interface Unacked {
  readonly queue: Queue;
  readonly message: StoredMessage;
  /** Absent for a message taken with `get`. */
  readonly consumer?: Consumer;
}

export interface Consumer {
  readonly tag: string;
  readonly queue: Queue;
  readonly channel: MemoryChannel;
  readonly limit: number;
  readonly noAck: boolean;
  readonly onMessage: (message: ConsumeMessage | null) => void;
  unacked: number;
}

/** What a connection asks of the network it was opened on. */
export interface Wire {
  holdingReplies(): boolean;
  sent(): void;
}

export const RELIABLE: Wire = { holdingReplies: () => false, sent: () => undefined };
