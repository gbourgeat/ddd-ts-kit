import { scan } from '../check/scan/scan.js';
import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import { isAssertedUse } from './is-asserted-use.js';
import { isConvertedCall } from './is-converted-call.js';
import { applyEdits } from './apply-edits.js';
import type { Edit } from './edit.js';
import type { ResultMethods } from './result-methods.js';
import { statementEnd } from './statement-end.js';

const DECLARATION = /(?<=^|\n)([ \t]*)const\s+([A-Za-z_$][\w$]*)\s*=\s*/g;

/**
 * `const result = Email.create(raw);` read only by assertions on a `Result`: the call takes the
 * place of each read and the declaration goes, so that the assertions can be rewritten.
 */
export function inlineResults(source: string, methods: ResultMethods): string {
  const { code } = scan(source);

  const edits = [...code.matchAll(DECLARATION)].flatMap((found): Edit[] => {
    const name = found[2] ?? '';
    const initializer = found.index + found[0].length;
    const end = statementEnd(code, initializer);

    if (!isConvertedCall(code, { start: initializer, end }, methods)) {
      return [];
    }

    const uses = usesIn(code, name, { from: end, to: blockEnd(code, end) });

    if (uses.length === 0 || !uses.every((at) => isAssertedUse({ code, source, at, name }))) {
      return [];
    }

    const call = source.slice(initializer, end).trim();

    return [
      declarationRemoval(code, found.index, end),
      ...uses.map((at) => ({ start: at, end: at + name.length, text: call })),
    ];
  });

  return applyEdits(source, edits);
}

function usesIn(code: string, name: string, range: { from: number; to: number }): number[] {
  const pattern = new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`, 'g');

  return [...code.slice(range.from, range.to).matchAll(pattern)].map((use) => range.from + use.index);
}

/** The offset of the brace closing the block the statement at `from` is in. */
function blockEnd(code: string, from: number): number {
  let depth = 0;

  for (let i = from; i < code.length; i += 1) {
    const char = code.charAt(i);

    depth += char === '{' ? 1 : char === '}' ? -1 : 0;

    if (depth < 0) {
      return i;
    }
  }

  return code.length;
}

/** The declaration, its line and the blank line after it. */
function declarationRemoval(code: string, start: number, end: number): Edit {
  const lineEnd = code.indexOf('\n', end);
  const blank = /^\n[ \t]*\n/.exec(code.slice(lineEnd));
  const stop = lineEnd === -1 ? code.length : lineEnd + (blank === null ? 1 : blank[0].lastIndexOf('\n') + 1);

  return { start, end: stop, text: '' };
}
