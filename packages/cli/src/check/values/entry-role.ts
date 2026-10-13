import { endAtDepthZero } from '../text/end-at-depth-zero.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';
import { arrowBody } from './arrow-body.js';
import { JAVASCRIPT_GLOBALS } from './javascript-globals.js';

/**
 * What an entry of an object literal holds: `behaviour`, a function; `built`, what a call or
 * `new` of the model built (`Money.of(1)`, `total.add(tax)`, `new Slot(..)`), a call of the
 * language aside (`Math.round(..)`, `new Date(..)`); `data`, anything else: a literal, a
 * parameter, an operation on them.
 */
export type EntryRole = 'behaviour' | 'built' | 'data';

const FUNCTION_EXPRESSION = /^(?:async\s+)?function\b/;
const NEW = /^new\s+([A-Za-z_$][\w$]*)/;
const CALL = /^([A-Za-z_$][\w$]*)(?:\s*\??\.\s*[\w$]+|\s*!)*\s*(?:<[^()]*>)?\s*\(/;
const NAME = /^([A-Za-z_$][\w$]*)\s*!?\s*(?:(?:as|satisfies)\b[\s\S]*)?$/;

/** The role of an expression, in blanked code; a name is read from its first declaration in `module`, found by name. */
export function expressionRole(expression: string, module: string, seen: ReadonlySet<string> = new Set()): EntryRole {
  const text = expression.trim();

  if (FUNCTION_EXPRESSION.test(text) || arrowBody(text, 0) !== undefined) {
    return 'behaviour';
  }

  const inner = text.replace(/^(?:\(\s*|await\s+)+/, '');
  const built = NEW.exec(inner) ?? CALL.exec(inner);

  if (built !== null) {
    return JAVASCRIPT_GLOBALS.has(built[1] ?? '') ? 'data' : 'built';
  }

  return namedRole(inner, module, seen);
}

/** A name alone, `as` or `satisfies` a type: the role of what it binds; anything else is data. */
function namedRole(text: string, module: string, seen: ReadonlySet<string>): EntryRole {
  const name = NAME.exec(text)?.[1];

  return name === undefined || seen.has(name) ? 'data' : boundRole(module, name, new Set([...seen, name]));
}

/** The role of what the first declaration of `name` binds: a parameter, declared nowhere, is data. */
function boundRole(module: string, name: string, seen: ReadonlySet<string>): EntryRole {
  const escaped = escapeRegExp(name);

  const declared = new RegExp(
    `(?<![\\w$.])(?:(?:async\\s+)?function\\s*\\*?\\s*${escaped}(?![\\w$])|(?:const|let|var)\\s+${escaped}\\s*(?::[^;]*?)?=(?![=>]))`,
  ).exec(module);

  if (declared === null) {
    return 'data';
  }

  if (!/^(?:const|let|var)\b/.test(declared[0])) {
    return 'behaviour';
  }

  const start = declared.index + declared[0].length;

  return expressionRole(module.slice(start, endAtDepthZero(module, start, ';')), module, seen);
}
