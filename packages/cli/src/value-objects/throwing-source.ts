import { scan } from '../check/scan/scan.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { closingAngle } from './closing-angle.js';
import { firstTypeArgument } from './first-type-argument.js';
import { ternaryReturns } from './ternary-returns.js';
import { applyEdits } from './apply-edits.js';
import type { Edit } from './edit.js';

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
const METHOD_HEADER = /(?<=^|\n)[ \t]*(?:(?:public|protected|private)\s+)?(static\s+)?([A-Za-z_$][\w$]*)\s*\(/g;
const RESULT_TYPE = /^\s*:\s*Result\s*</;

/**
 * Turns every method of a value object that returns `Result<T, E>` into one that returns `T`:
 * `return err(refusal)` becomes `throw refusal`, `return ok(value)` becomes `return value`.
 */
export function throwingSource(source: string): ThrowingSource {
  const { code } = scan(source);
  const className = VALUE_OBJECT_CLASS.exec(code)?.[1];
  const changed = className === undefined ? [] : resultMethods(code, source);
  const throws = changed.length === 0 ? [] : returnsOf({ code, source }, 'err', 'throw ');
  const values = changed.length === 0 ? [] : returnsOf({ code, source }, 'ok', 'return ');
  const ternaries = changed.length === 0 ? [] : ternaryReturns(code, source);
  const edits = [...changed.map(({ edit }) => edit), ...throws, ...values, ...ternaries];

  return {
    source: applyEdits(source, edits),
    className,
    statics: changed.filter((method) => method.isStatic).map(({ name }) => `${className ?? ''}.${name}`),
    instance: changed.filter((method) => !method.isStatic).map(({ name }) => name),
    throws: throws.length + ternaries.length,
  };
}

interface ChangedMethod {
  readonly name: string;
  readonly isStatic: boolean;
  readonly edit: Edit;
}

function resultMethods(code: string, source: string): ChangedMethod[] {
  return [...code.matchAll(METHOD_HEADER)].flatMap((header) => {
    const close = matchingBracket(code, header.index + header[0].length - 1);
    const typed = RESULT_TYPE.exec(code.slice(close + 1));

    if (typed === null) {
      return [];
    }

    const open = close + typed[0].length;
    const end = closingAngle(code, open) + 1;
    const value = source.slice(open + 1, firstTypeArgument(code, open)).trim();
    const start = close + 1 + typed[0].indexOf(':') + 1;

    return [{ name: header[2] ?? '', isStatic: header[1] !== undefined, edit: { start, end, text: ` ${value}` } }];
  });
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
