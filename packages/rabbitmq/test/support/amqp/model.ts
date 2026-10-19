import type { ChannelModel, ConsumeMessage, MessageProperties } from 'amqplib';
import type { AmqpError } from './errors.js';

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
  readonly queue: QueueState;
  readonly message: StoredMessage;
  /** Absent for a message taken with `get`. */
  readonly consumer?: Consumer;
}

export interface Consumer {
  readonly tag: string;
  readonly queue: QueueState;
  readonly channel: ConsumerChannel;
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

/** A queue, as the broker and the channels reach it. */
export interface QueueState {
  readonly name: string;
  readonly durable: boolean;
  readonly args: Arguments;
  readonly consumers: Consumer[];
  readonly messageCount: number;
  enqueue(message: StoredMessage, atHead?: boolean): void;
  take(): StoredMessage | undefined;
  purge(): number;
  dispatch(): void;
}

/** The channel a consumer reads on: where its queue hands it messages. */
export interface ConsumerChannel {
  deliver(consumer: Consumer, message: StoredMessage): void;
  cancelledByBroker(consumer: Consumer): void;
}

/** Where a queue sends what expired or was rejected. */
export interface DeadLettering {
  deadLetter(queue: QueueState, message: StoredMessage): void;
}

/** What the channels need of the broker: its exchanges and queues. */
export interface BrokerState extends DeadLettering {
  exchange(name: string): Exchange | undefined;
  declareExchange(name: string, type: string, durable: boolean): Exchange | AmqpError;
  deleteExchange(name: string): void;
  queue(name: string): QueueState | undefined;
  declareQueue(name: string, durable: boolean, args: Arguments): QueueState | AmqpError;
  deleteQueue(queue: QueueState): number;
  nextConsumerTag(): string;
  route(exchange: Exchange, routingKey: string): QueueState[];
}

/** A channel, as the connection it lives on closes it. */
export interface Closable {
  teardown(): void;
}

/** What a channel tells the connection it lives on. */
export interface ChannelOwner {
  forget(channel: Closable): void;
}

/** A connection the network can cut. */
export interface Severable extends ChannelModel {
  sever(): void;
}

/** What a network needs of the broker: a connection on that network. */
export interface Opening {
  open(wire: Wire): Promise<Severable>;
}
