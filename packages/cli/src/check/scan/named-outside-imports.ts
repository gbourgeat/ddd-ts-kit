import { escapeRegExp } from '../text/escape-reg-exp';
import { scan } from './scan';

const IMPORT = /^[ \t]*import\s[^;]*;/gm;

/** Whether code of the text names this identifier: an import, a comment or a string does not. */
export function namedOutsideImports(text: string, name: string): boolean {
  return new RegExp(`\\b${escapeRegExp(name)}\\b`).test(scan(text).code.replace(IMPORT, ''));
}
