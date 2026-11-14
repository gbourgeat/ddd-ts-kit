import type { BlockCommentRecord } from './block-comment-record';
import type { CommentRecord } from './comment-record';
import { findImports } from './find-imports';
import type { ImportRecord } from './import-record';
import { Lexer } from './lexer';
import type { StringRecord } from './string-record';

export interface Scan {
  /** Source with comments and literal contents blanked; offsets and lines are preserved. */
  readonly code: string;
  readonly strings: readonly StringRecord[];
  readonly comments: readonly CommentRecord[];
  readonly blockComments: readonly BlockCommentRecord[];
  readonly imports: readonly ImportRecord[];
  /**
   * Whether the lexer may have taken code for text: it read a regular expression literal, which a
   * division after some expressions is read as, or a template or a regular expression that did not
   * close. What decides on `code` alone, with nothing to check it against, reads such a source as uncertain.
   */
  readonly uncertain: boolean;
  lineAt(offset: number): number;
}

/** Tells code from comments, strings, templates and regular expressions, so that imports are found without a compiler. */
export function scan(source: string): Scan {
  const lexer = new Lexer(source);

  lexer.run();

  const lineAt = (offset: number): number => lexer.lineAt(offset);

  return {
    code: lexer.code,
    strings: lexer.strings,
    comments: lexer.comments,
    blockComments: lexer.blockComments,
    imports: findImports(lexer.code, lexer.strings, lineAt),
    uncertain: lexer.regexes > 0 || lexer.unclosed,
    lineAt,
  };
}
