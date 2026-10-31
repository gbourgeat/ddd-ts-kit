import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import { perFile } from '../support/per-file';
import { matchingBracket } from '../text/matching-bracket';

const CONTROL = /(?<![\w$.])(?:(if|while|for(?:\s+await)?)\s*\(|(else|do)(?![\w$]))/g;
/** What follows `else` or `do` when the word is a property name or a method, not a statement. */
const AFTER_A_NAME = ':,)=?;.(]';

const FIX =
  'Write the body between braces, on its own lines: `if (..) {`, the body, then `}`, and `} else {` on the line of the closing brace. A branch is then visible at a glance, and a statement added to it later cannot silently fall outside it.';

export const cleanBraces: Rule = {
  id: 'clean/braces',
  description:
    'Every `if`, `else`, `for`, `while` and `do` has braces, and its body is on its own lines; `else` follows the closing brace on the same line. A ternary and an arrow function returning an expression are not judged. An approximation of what ESLint holds in full.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const { code } = file.scan;

      return [...code.matchAll(CONTROL)].flatMap((match) => {
        const defect =
          match[1] === undefined ? defectOfWord(code, match) : defectOfBody(code, afterCondition(code, match));

        return defect === undefined ? [] : [finding(file.scan.lineAt(match.index), match[1] ?? match[2] ?? '', defect)];
      });
    });
  },
};

type Defect = 'bare' | 'inline' | 'apart';

function finding(line: number, keyword: string, defect: Defect): Finding {
  const name = keyword.startsWith('for') ? 'for' : keyword;

  const messages: Record<Defect, string> = {
    bare: `The body of this \`${name}\` has no braces.`,
    inline: `The body of this \`${name}\` shares a line with its braces.`,
    apart: 'This `else` starts a line instead of following the closing brace.',
  };

  return { line, message: messages[defect], fix: FIX };
}

/** `else` and `do` carry no condition: the body starts right after the word. */
function defectOfWord(code: string, match: RegExpExecArray): Defect | undefined {
  const body = nextCode(code, match.index + match[0].length);
  const next = code.charAt(body);

  if (next === '' || AFTER_A_NAME.includes(next) || /^if(?![\w$])/.test(code.slice(body))) {
    return undefined;
  }

  return match[2] === 'else' && startsItsLine(code, match.index) ? 'apart' : defectOfBody(code, body);
}

/** Offset of what follows the parenthesis closing the condition of an `if`, a `for` or a `while`. */
function afterCondition(code: string, match: RegExpExecArray): number {
  return nextCode(code, matchingBracket(code, match.index + match[0].length - 1) + 1);
}

/** A `;` is the end of a `do .. while (..);`, which is judged at its `do`. */
function defectOfBody(code: string, body: number): Defect | undefined {
  const next = code.charAt(body);

  if (next === ';' || next === '') {
    return undefined;
  }

  if (next !== '{') {
    return 'bare';
  }

  const inside = code.slice(body + 1, matchingBracket(code, body));

  return inside.trim() === '' || (/^[ \t]*\r?\n/.test(inside) && /\n[ \t]*$/.test(inside)) ? undefined : 'inline';
}

function startsItsLine(code: string, at: number): boolean {
  const before = code.slice(0, at);

  return before.trimEnd().endsWith('}') && /\n[ \t]*$/.test(before);
}

function nextCode(code: string, from: number): number {
  let at = from;

  while (/\s/.test(code.charAt(at))) {
    at += 1;
  }

  return at;
}
