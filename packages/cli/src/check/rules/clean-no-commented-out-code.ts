import { commentLines } from '../comments/comment-lines.js';
import { looksLikeCode } from '../comments/looks-like-code.js';
import type { Rule } from '../model/rule.js';
import { perFile } from '../support/per-file.js';

const FIX = 'Delete it: version control keeps the old version, and code that does not run misleads the reader.';

export const cleanNoCommentedOutCode: Rule = {
  id: 'clean/no-commented-out-code',
  description: 'No code in comments, the samples of a JSDoc block aside. Version control remembers.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      // A JSDoc block documents: the code it shows, fenced, under `@example` or simply indented, is a sample.
      const code = commentLines(file).filter(
        (comment) => !comment.jsdoc && !comment.sample && looksLikeCode(comment.text),
      );

      // One report per run of consecutive lines: a commented-out block is one finding.
      return code
        .filter((comment, index) => comment.line !== (code[index - 1]?.line ?? -1) + 1)
        .map((comment) => ({
          line: comment.line,
          message: `The comment holds code: "${comment.text.trim().slice(0, 60)}".`,
          fix: FIX,
        }));
    });
  },
};
