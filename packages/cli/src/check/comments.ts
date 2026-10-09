import type { SourceFile } from './types.js';

/** One line of comment text, whatever the comment syntax, with what the comment rules need to know. */
export interface CommentLine {
  readonly line: number;
  readonly text: string;
  readonly block: boolean;
  readonly jsdoc: boolean;
  /** True when code precedes the comment on its line. */
  readonly trailing: boolean;
  /** Inside a JSDoc `@example` or a fenced block: code is expected there. */
  readonly sample: boolean;
}

export function commentLines(file: SourceFile): CommentLine[] {
  const lines: CommentLine[] = file.scan.comments.map((comment) => ({
    line: comment.line,
    text: comment.text,
    block: false,
    jsdoc: false,
    trailing: !comment.ownLine,
    sample: false,
  }));
  for (const comment of file.scan.blockComments) {
    let sample = false;
    let fenced = false;
    comment.text.split('\n').forEach((raw, index) => {
      const text = raw.replace(/^\s*\*+ ?/, '').trim();
      if (text.startsWith('```')) fenced = !fenced;
      else if (text.startsWith('@')) sample = text.startsWith('@example');
      lines.push({ line: comment.line + index, text, block: true, jsdoc: comment.jsdoc, trailing: false, sample: sample || fenced || text.startsWith('```') });
    });
  }
  return lines.sort((a, b) => a.line - b.line);
}

/** Comments that are instructions to a tool, not prose: never judged as code or noise. */
export const isDirective = (text: string): boolean =>
  /^(?:\/?ddd-ts-kit[-:]|eslint-|@ts-|prettier-|biome-|istanbul |c8 |v8 |#region|#endregion|@vitest-|@jest-|\/ <reference)/.test(text);
