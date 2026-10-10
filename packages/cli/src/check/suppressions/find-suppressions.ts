import type { SourceFile } from '../model/source-file.js';

const DIRECTIVE = 'ddd-ts-kit-disable-next-line';
const DIRECTIVE_END = /^(?:\W|$)/;
const LINE_BREAK = /[\n\r\u2028\u2029]/;

export interface Suppression {
  readonly file: string;
  /** Line of the directive; it silences its rule on the next line. */
  readonly line: number;
  readonly ruleId: string;
  readonly reason: string;
}

export function findSuppressions(file: SourceFile): Suppression[] {
  return file.scan.comments.flatMap((comment) => {
    const written = directiveText(comment.text);

    if (written === undefined || !comment.ownLine) {
      return [];
    }

    const [head = '', ...reason] = written.split('--');

    return [{ file: file.path, line: comment.line, ruleId: head.trim(), reason: reason.join('--').trim() }];
  });
}

/** What follows the directive on its line; undefined when the comment is not one, or runs over several lines. */
function directiveText(comment: string): string | undefined {
  if (!comment.startsWith(DIRECTIVE)) {
    return undefined;
  }

  const after = comment.slice(DIRECTIVE.length);
  const written = after.trimStart();

  return DIRECTIVE_END.test(after) && !LINE_BREAK.test(written) ? written : undefined;
}
