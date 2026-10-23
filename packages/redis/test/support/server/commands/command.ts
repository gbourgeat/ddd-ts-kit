import type { Keyspace } from '../keyspace';
import type { Reply } from '../reply';

/** A read with `BLOCK` that found nothing: tried again each time one of its keys changes, until its timeout. */
export interface Wait {
  readonly kind: 'wait';
  readonly keys: readonly string[];
  /** 0 waits for ever. */
  readonly timeoutMs: number;
  /** The reply once there is something to read, undefined while there is not. */
  retry(): Reply | undefined;
}

/** What a command reaches besides its arguments: the keys, the clock, the connection and the server. */
export interface Context {
  readonly keyspace: Keyspace;
  now(): number;
  /** A command run by a script or inside `MULTI` never waits. */
  readonly mayBlock: boolean;
  readonly connection: Connection;
  /** Wakes the reads waiting on the key. */
  changed(key: string): void;
  /** Delivers a message to the subscribers of the channel and answers how many there were. */
  publish(channel: string, message: string): number;
  /** Runs a command as a script does, with the same keys and clock. */
  run(command: readonly string[]): Reply;
}

/** The state of one client connection that a command reads or changes. */
export interface Connection {
  protocol: 2 | 3;
  name: string | undefined;
  readonly id: number;
  readonly channels: Set<string>;
  push(reply: Reply): void;
  quit(): void;
}

/** Arity as Redis counts it, the name included: positive for exactly, negative for at least. */
export interface Command {
  readonly arity: number;
  run(args: readonly string[], context: Context): Reply | Wait;
}

export type Commands = Readonly<Record<string, Command>>;

export const upper = (text: string | undefined): string => (text ?? '').toUpperCase();
