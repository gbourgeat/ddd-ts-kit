/**
 * Whether a write is conditional on the version a client read: `required`, a request without
 * `If-Match` is refused with 428; `optional`, it runs unconditionally. Either way a tag that names
 * another version than the current one is refused with 412 by the use case, which compares it.
 */
export const IfMatch = {
  required: 'required',
  optional: 'optional',
} as const;

export type IfMatch = (typeof IfMatch)[keyof typeof IfMatch];
