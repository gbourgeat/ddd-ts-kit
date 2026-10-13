const REFUSED = /^\{ ?ok: false, error: (?:expect\.objectContaining\()?\{ ?code: '([A-Z0-9_]+)',? ?\}\)?,? ?\}$/;

/**
 * The code a `toMatchObject` argument expects of a refused `Result`, when it expects nothing
 * else: `{ ok: false, error: { code: 'INVALID_EMAIL' } }`, the error possibly wrapped in
 * `expect.objectContaining(..)`. A shape that also expects facts is left to a person.
 */
export function refusalCode(argument: string): string | undefined {
  return REFUSED.exec(argument.replace(/\s+/g, ' ').trim())?.[1];
}
