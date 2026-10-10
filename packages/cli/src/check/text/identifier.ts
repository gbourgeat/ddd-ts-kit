import { escapeRegExp } from './escape-reg-exp.js';

/** Matches `name` used as an identifier, not as a part of a longer one. */
export function identifier(name: string): RegExp {
  return new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`);
}
