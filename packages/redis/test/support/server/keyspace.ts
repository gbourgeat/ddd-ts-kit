import { CommandError } from './reply';
import { Stream } from './stream';

export type Value =
  | { readonly type: 'string'; text: string }
  | { readonly type: 'hash'; readonly fields: Map<string, string> }
  | { readonly type: 'zset'; readonly scores: Map<string, number> }
  | { readonly type: 'stream'; readonly stream: Stream };

type Kind = Value['type'];

type ValueOf<K extends Kind> = Extract<Value, { type: K }>;

/**
 * The keys of the server, one database, each with its value and, when it has one, the time it
 * expires at. An expired key is gone for every command that looks at it, as Redis removes it on
 * access. A command on a key of another type is refused with `WRONGTYPE`.
 */
export class Keyspace {
  private readonly values = new Map<string, Value>();

  private readonly expiries = new Map<string, number>();

  constructor(private readonly now: () => number) {}

  get(key: string): Value | undefined {
    const expiry = this.expiries.get(key);

    if (expiry !== undefined && expiry <= this.now()) {
      this.delete(key);
    }

    return this.values.get(key);
  }

  /** The value of the key if it holds the type, undefined when there is none. */
  read<K extends Kind>(key: string, type: K): ValueOf<K> | undefined {
    const value = this.get(key);

    if (value === undefined) {
      return undefined;
    }

    if (!isOf(value, type)) {
      throw CommandError.wrongType();
    }

    return value;
  }

  /** The value of the key, created empty when there is none. */
  write<K extends Kind>(key: string, type: K): ValueOf<K> {
    const existing = this.read(key, type);

    if (existing !== undefined) {
      return existing;
    }

    const created = emptyOf(type);

    this.values.set(key, created);

    return created;
  }

  set(key: string, value: Value, expiresAt?: number): void {
    this.values.set(key, value);

    if (expiresAt === undefined) {
      this.expiries.delete(key);
    } else {
      this.expiries.set(key, expiresAt);
    }
  }

  delete(key: string): boolean {
    this.expiries.delete(key);

    return this.values.delete(key);
  }

  /** Drops a collection left empty by a command, as Redis does; a stream stays, empty or not. */
  dropIfEmpty(key: string): void {
    const value = this.values.get(key);
    const size = value?.type === 'hash' ? value.fields.size : value?.type === 'zset' ? value.scores.size : 1;

    if (size === 0) {
      this.delete(key);
    }
  }

  expire(key: string, at: number): boolean {
    if (this.get(key) === undefined) {
      return false;
    }

    this.expiries.set(key, at);

    return true;
  }

  /** Milliseconds left: -2 for no key, -1 for a key that does not expire. */
  ttl(key: string): number {
    if (this.get(key) === undefined) {
      return -2;
    }

    const expiry = this.expiries.get(key);

    return expiry === undefined ? -1 : expiry - this.now();
  }

  keys(): string[] {
    return [...this.values.keys()].filter((key) => this.get(key) !== undefined);
  }
}

function isOf<K extends Kind>(value: Value, type: K): value is ValueOf<K> {
  return value.type === type;
}

function emptyOf<K extends Kind>(type: K): ValueOf<K> {
  const values: { readonly [T in Kind]: () => ValueOf<T> } = {
    string: () => ({ type: 'string', text: '' }),
    hash: () => ({ type: 'hash', fields: new Map() }),
    zset: () => ({ type: 'zset', scores: new Map() }),
    stream: () => ({ type: 'stream', stream: new Stream() }),
  };

  return values[type]();
}
