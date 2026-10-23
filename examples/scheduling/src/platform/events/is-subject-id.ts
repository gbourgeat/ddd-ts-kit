/**
 * What the id of a data subject is made of, as a tenant id of the kernel: letters, digits, `_`
 * and `-`, at most 63 characters, what a slug or a UUID is made of. A name or an email never
 * matches, so neither can reach the append-only trail through a mistyped argument.
 */
const SUBJECT_ID = /^[A-Za-z0-9_-]{1,63}$/;

export function isSubjectId(value: string): boolean {
  return SUBJECT_ID.test(value);
}
