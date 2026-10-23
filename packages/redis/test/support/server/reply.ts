/**
 * A reply of the server before it is written: the same value goes to a client in RESP2 or RESP3,
 * or to a Lua script, each with its own conversion, as Redis converts one reply three ways.
 */
export type Reply =
  | { readonly kind: 'status'; readonly text: string }
  | { readonly kind: 'error'; readonly text: string }
  | { readonly kind: 'integer'; readonly value: number }
  | { readonly kind: 'bulk'; readonly value: string | null }
  | { readonly kind: 'array'; readonly items: readonly Reply[] | null }
  | { readonly kind: 'map'; readonly entries: readonly (readonly [string, Reply])[] }
  | { readonly kind: 'push'; readonly items: readonly Reply[] }
  | { readonly kind: 'text'; readonly value: string };

export const OK: Reply = { kind: 'status', text: 'OK' };

export const NIL: Reply = { kind: 'bulk', value: null };

export const status = (text: string): Reply => ({ kind: 'status', text });

export const integer = (value: number): Reply => ({ kind: 'integer', value });

export const bulk = (value: string | null): Reply => ({ kind: 'bulk', value });

export const array = (items: readonly Reply[] | null): Reply => ({ kind: 'array', items });

export const bulks = (values: readonly string[]): Reply => array(values.map(bulk));

export const map = (entries: readonly (readonly [string, Reply])[]): Reply => ({ kind: 'map', entries });

/** A refusal of a command, answered as an error reply: its text starts with its kind (`ERR`, `WRONGTYPE`). */
export class CommandError extends Error {
  static wrongType(): CommandError {
    return new CommandError('WRONGTYPE Operation against a key holding the wrong kind of value');
  }

  static syntax(): CommandError {
    return new CommandError('ERR syntax error');
  }

  static notAnInteger(): CommandError {
    return new CommandError('ERR value is not an integer or out of range');
  }

  static notAFloat(): CommandError {
    return new CommandError('ERR value is not a valid float');
  }

  static arity(name: string): CommandError {
    return new CommandError(`ERR wrong number of arguments for '${name.toLowerCase()}' command`);
  }
}

/** The integer an argument holds, or the refusal Redis answers. */
export function integerOf(text: string | undefined): number {
  const value = Number(text);

  if (text === undefined || !/^-?\d+$/.test(text) || !Number.isSafeInteger(value)) {
    throw CommandError.notAnInteger();
  }

  return value;
}
