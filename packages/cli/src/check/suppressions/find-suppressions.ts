import type { SourceFile } from '../model/source-file.js';

const DIRECTIVE = /^ddd-ts-kit-disable-next-line\b\s*(.*)$/;

export interface Suppression {
  readonly file: string;
  /** Line of the directive; it silences its rule on the next line. */
  readonly line: number;
  readonly ruleId: string;
  readonly reason: string;
}

export function findSuppressions(file: SourceFile): Suppression[] {
  return file.scan.comments.flatMap((comment) => {
    const match = DIRECTIVE.exec(comment.text);

    if (match === null || !comment.ownLine) {
      return [];
    }

    const [head = '', ...reason] = (match[1] ?? '').split('--');

    return [{ file: file.path, line: comment.line, ruleId: head.trim(), reason: reason.join('--').trim() }];
  });
}
