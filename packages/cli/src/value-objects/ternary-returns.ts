import { BRACKETS } from '../check/text/brackets.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import type { Edit } from './edit.js';
import { statementEnd } from './statement-end.js';

const RETURN = /(?<=^|\n)([ \t]*)return\s+/g;
const BRANCH = /^\s*(ok|err)\s*\(/;

interface Branch {
  readonly helper: string;
  readonly value: string;
  readonly end: number;
}

/**
 * `return valid ? ok(value) : err(refusal);` becomes an `if` that returns the value and a
 * `throw` of the refusal, in either order of the branches.
 */
export function ternaryReturns(code: string, source: string): Edit[] {
  return [...code.matchAll(RETURN)].flatMap((found): Edit[] => {
    const start = found.index + found[0].length;
    const end = statementEnd(code, start);
    const question = topLevelQuestion(code, { start, end });
    const yes = question === undefined ? undefined : branchAt(code, source, question + 1);
    const colon = yes === undefined ? -1 : code.indexOf(':', yes.end);
    const no = colon === -1 ? undefined : branchAt(code, source, colon + 1);

    if (question === undefined || yes === undefined || no === undefined || no.end !== end || yes.helper === no.helper) {
      return [];
    }

    const indent = found[1] ?? '';
    const condition = source.slice(start, question).trim();
    const text = `${indent}if (${condition}) {\n${indent}  ${statement(yes)};\n${indent}}\n\n${indent}${statement(no)}`;

    return [{ start: found.index, end, text }];
  });
}

function statement(branch: Branch): string {
  return `${branch.helper === 'ok' ? 'return' : 'throw'} ${branch.value}`;
}

function branchAt(code: string, source: string, from: number): Branch | undefined {
  const call = BRANCH.exec(code.slice(from));

  if (call === null) {
    return undefined;
  }

  const open = from + call[0].length - 1;
  const close = matchingBracket(code, open);
  const after = code.slice(close + 1).search(/\S/);

  return { helper: call[1] ?? '', value: source.slice(open + 1, close).trim(), end: close + 1 + Math.max(after, 0) };
}

/** The `?` of a conditional at the top level of the statement; `?.` and `??` are not one. */
function topLevelQuestion(code: string, range: { start: number; end: number }): number | undefined {
  let depth = 0;

  for (let i = range.start; i < range.end; i += 1) {
    const char = code.charAt(i);

    depth += BRACKETS.openers.includes(char) ? 1 : BRACKETS.closers.includes(char) ? -1 : 0;

    if (depth === 0 && char === '?' && !/[?.]/.test(code.charAt(i + 1)) && code.charAt(i - 1) !== '?') {
      return i;
    }
  }

  return undefined;
}
