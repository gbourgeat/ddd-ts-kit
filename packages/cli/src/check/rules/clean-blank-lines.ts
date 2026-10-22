import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { statementBlocks } from '../structure/statement-blocks';
import { perFile } from '../support/per-file';

const RETURN = /^return(?![\w$]|\s*:)/;
const LABEL = /^(?:case\b.*|default\s*):$/;

const RETURN_FIX =
  'Leave a blank line before `return`, unless it is alone in its block: the outcome of a function stands apart from the steps that build it.';

const PADDING_FIX =
  'Remove the blank line: a block starts on the line after its opening brace and ends on the line before its closing one.';

const NAMED_RETURN = /^return\??\s*\([^()]*\)\s*[:{]/;
const BRACELESS = /^(?:\}\s*)?(?:else\s+)?(?:if|for|while)\b.*\)$|^(?:\}\s*)?else$/;

/** One physical line: what the scanner kept of it as code, and whether the source line is empty. */
interface Line {
  readonly code: string;
  readonly isBlank: boolean;
  /** The line ends with the brace opening a block of statements, or starts with the one closing it. */
  readonly opensBlock: boolean;
  readonly closesBlock: boolean;
}

export const cleanBlankLines: Rule = {
  id: 'clean/blank-lines',
  description:
    'A blank line before every `return` that is not alone in its block, and no blank line padding a block of statements (an object, array or type literal is not one). An approximation of the layout ESLint and the formatter hold in full.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const lines = linesOf(file);

      return lines.flatMap((_, index) => [...crampedReturn(lines, index), ...paddedBlock(lines, index)]);
    });
  },
};

function linesOf(file: SourceFile): Line[] {
  const blocks = statementBlocks(file.scan.code);
  const text = file.text.split('\n');
  let start = 0;

  return file.scan.code.split('\n').map((raw, index) => {
    const code = raw.trim();
    const from = start;

    start += raw.length + 1;

    return {
      code,
      isBlank: (text[index] ?? '').trim() === '',
      opensBlock: code.endsWith('{') && blocks.opens.has(from + raw.trimEnd().length - 1),
      closesBlock: code.startsWith('}') && blocks.closes.has(from + raw.indexOf('}')),
    };
  });
}

function crampedReturn(lines: readonly Line[], index: number): Finding[] {
  const code = lines[index]?.code ?? '';

  if (!RETURN.test(code) || NAMED_RETURN.test(code)) {
    return [];
  }

  const above = lineAbove(lines, index);

  if (
    above === undefined ||
    above.isBlank ||
    above.code.endsWith('{') ||
    LABEL.test(above.code) ||
    BRACELESS.test(above.code)
  ) {
    return [];
  }

  return [{ line: index + 1, message: 'No blank line before this `return`.', fix: RETURN_FIX }];
}

/** The line above, comments stepped over: a comment directly under a blank line or an opening brace belongs to the `return`. */
function lineAbove(lines: readonly Line[], index: number): Line | undefined {
  for (let at = index - 1; at >= 0; at -= 1) {
    const line = lines[at];

    if (line !== undefined && (line.isBlank || line.code !== '')) {
      return line;
    }
  }

  return undefined;
}

function paddedBlock(lines: readonly Line[], index: number): Finding[] {
  const line = lines[index];

  if (line?.isBlank !== true) {
    return [];
  }

  const afterOpening = lines[index - 1]?.opensBlock === true;
  const beforeClosing = lines[index + 1]?.closesBlock === true;

  return afterOpening || beforeClosing
    ? [
        {
          line: index + 1,
          message: `A blank line pads the ${afterOpening ? 'start' : 'end'} of a block.`,
          fix: PADDING_FIX,
        },
      ]
    : [];
}
