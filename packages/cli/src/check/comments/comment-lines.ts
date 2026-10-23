import type { SourceFile } from '../model/source-file';
import type { BlockCommentRecord } from '../scan/block-comment-record';

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

  return [...lines, ...file.scan.blockComments.flatMap(linesOfBlock)].sort((a, b) => a.line - b.line);
}

function linesOfBlock(comment: BlockCommentRecord): CommentLine[] {
  let sample = false;
  let fenced = false;

  return comment.text.split('\n').map((raw, index) => {
    const text = raw.replace(/^\s*\*+ ?/, '').trim();
    const fence = text.startsWith('```');

    if (fence) {
      fenced = !fenced;
    } else if (text.startsWith('@')) {
      sample = text.startsWith('@example');
    }

    return {
      line: comment.line + index,
      text,
      block: true,
      jsdoc: comment.jsdoc,
      trailing: false,
      sample: sample || fenced || fence,
    };
  });
}
