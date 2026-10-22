import type { Exported } from '../exports/exported';
import { signatureAt } from '../structure/signature-at';
import { braceDepthAt } from '../text/brace-depth-at';
import { endAtDepthZero } from '../text/end-at-depth-zero';
import { escapeRegExp } from '../text/escape-reg-exp';

/**
 * The declaration of a name at the top of a module, read as an export would be: a function with
 * its body, a constant up to its `;`, a class only by its kind. Undefined when the module does
 * not declare it there.
 */
export function localDeclaration(code: string, name: string): Exported | undefined {
  const pattern = new RegExp(
    `(?<![\\w$.])(?:(?:async\\s+)?(function)\\s*\\*?\\s*|(const|let|var)\\s+|(class)\\s+)${escapeRegExp(name)}(?![\\w$])`,
    'g',
  );

  const match = [...code.matchAll(pattern)].find(({ index }) => braceDepthAt(code, index) === 0);

  if (match === undefined) {
    return undefined;
  }

  const at = match.index;
  const afterName = at + match[0].length;
  const base = { name, line: 0 };

  if (match[3] !== undefined) {
    return { ...base, kind: 'class', text: '', signature: '' };
  }

  if (match[2] !== undefined) {
    const text = code.slice(at, endAtDepthZero(code, afterName, ';'));

    return { ...base, kind: 'const', text, signature: text };
  }

  const body = signatureAt(code, code.indexOf('(', afterName));

  return body === undefined
    ? undefined
    : { ...base, kind: 'function', text: code.slice(at, body.bodyClose + 1), signature: code.slice(at, body.bodyOpen) };
}
