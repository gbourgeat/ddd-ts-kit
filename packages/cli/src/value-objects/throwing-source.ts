import { scan } from '../check/scan/scan.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { closingAngle } from './closing-angle.js';
import { ternaryReturns } from './ternary-returns.js';
import { applyEdits } from './apply-edits.js';
import type { Edit } from './edit.js';
import { type Range, resultMethodDeclarations } from './result-method-declarations.js';

/** A value object file once its factories throw, and the methods that changed. */
export interface ThrowingSource {
  readonly source: string;
  readonly className: string | undefined;
  readonly statics: readonly string[];
  readonly instance: readonly string[];
  /** How many `return err(..)` became `throw ..`. */
  readonly throws: number;
}

const VALUE_OBJECT_CLASS = /\bclass\s+([A-Za-z_$][\w$]*)(?:<[^{]*>)?\s+extends\s+ValueObject\b/;

/**
 * Turns every method of the value object class of a file that returns `Result<T, E>` into one
 * that returns `T`: `return err(refusal)` becomes `throw refusal`, `return ok(value)` becomes
 * `return value`, inside those methods only. A function or another class of the file keeps its
 * `Result`.
 */
export function throwingSource(source: string): ThrowingSource {
  const { code } = scan(source);
  const declared = VALUE_OBJECT_CLASS.exec(code);
  const className = declared?.[1];
  const changed = declared === null ? [] : resultMethodDeclarations(code, source, classBody(code, declared));
  const inside = (edit: Edit): boolean => changed.some(({ body }) => edit.start > body.start && edit.end <= body.end);
  const texts = { code, source };
  const throws = returnsOf(texts, 'err', 'throw ').filter(inside);
  const values = returnsOf(texts, 'ok', 'return ').filter(inside);
  const ternaries = ternaryReturns(code, source).filter(inside);

  return {
    source: applyEdits(source, [...changed.map(({ edit }) => edit), ...throws, ...values, ...ternaries]),
    className,
    statics: changed.filter((method) => method.isStatic).map(({ name }) => `${className ?? ''}.${name}`),
    instance: changed.filter((method) => !method.isStatic).map(({ name }) => name),
    throws: throws.length + ternaries.length,
  };
}

/** From the brace opening the body of the class to the one closing it, past the type arguments of `ValueObject<..>`. */
function classBody(code: string, declared: RegExpExecArray): Range {
  const after = declared.index + declared[0].length;
  const typed = /^\s*</.exec(code.slice(after));
  const from = typed === null ? after : closingAngle(code, after + typed[0].length - 1) + 1;
  const start = code.indexOf('{', from);

  return { start, end: start === -1 ? -1 : matchingBracket(code, start) };
}

/** A source, and its scanned code. */
interface Texts {
  readonly code: string;
  readonly source: string;
}

/** `return err(x)` or `return ok(x)`, with what it becomes. */
function returnsOf({ code, source }: Texts, helper: 'err' | 'ok', keyword: string): Edit[] {
  return [...code.matchAll(new RegExp(`\\breturn\\s+${helper}\\s*\\(`, 'g'))].map((found) => {
    const open = found.index + found[0].length - 1;
    const close = matchingBracket(code, open);

    return {
      start: found.index,
      end: close + 1,
      text: `${keyword}${source
        .slice(open + 1, close)
        .trim()
        .replace(/,$/, '')}`,
    };
  });
}
