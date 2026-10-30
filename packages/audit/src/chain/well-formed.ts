/** With the `u` flag a pair of surrogates is one character: what matches is a surrogate alone, which UTF-8 cannot write. */
const LONE_SURROGATE = /\p{Surrogate}/gu;

/** A PostgreSQL text refuses it. */
const NUL = '\u0000';

const REPLACEMENT = '\ufffd';

/**
 * The value with U+FFFD in place of each unit of text no store can keep, in every text it holds,
 * the keys of its objects included. A hash is computed over this form and a store writes this
 * form, so what is read back is what was hashed. Anything well formed comes back the same.
 */
export function wellFormed<Value>(value: Value): Value;

export function wellFormed(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(LONE_SURROGATE, REPLACEMENT).replaceAll(NUL, REPLACEMENT);
  }

  if (Array.isArray(value)) {
    return value.map((member: unknown) => wellFormed(member));
  }

  if (typeof value !== 'object' || value === null || value instanceof Date) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, member]) => [wellFormed(key), wellFormed(member)]));
}
