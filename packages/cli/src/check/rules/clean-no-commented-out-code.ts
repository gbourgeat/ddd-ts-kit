import type { Rule, Violation } from '../types.js';
import { commentLines, isDirective } from '../comments.js';
import { reporter } from './helpers.js';

const CODE_SHAPES: readonly RegExp[] = [
  /;\s*$/,
  /^[)}\]]+[;,]?$/,
  /[^\s]\s*\{$/,
  /^(?:const|let|var)\s+[\w${[][^=]*=/,
  /^import\s.*\bfrom\s+['"]/,
  /^import\s+['"]/,
  /^export\s+(?:const|let|function|class|default|type|interface|\{|\*)/,
  /^return\s+[^.]*[;)\]}]$/,
  /^(?:if|for|while|switch)\s*\(.*\)\s*\{?$/,
  /^(?:else|try|finally)\s*\{$/,
  /^await\s+[\w$.]+\(/,
  /^[\w$.]+\s*(?:=|\+=|-=)\s*[^=].*[;)\]}'"\w]$/,
  /=>\s*[{(]/,
  /\([^)]*\)\s*=>/,
  /^[\w$.#]+\([^)]*\)[;,]?$/,
  /^(?:public|private|protected|static|readonly|async)\s+[\w$#]+\s*[(:=]/,
];

/** Prose sometimes ends like code; these openings are never statements. */
const PROSE = /^(?:TODO|FIXME|NOTE|See |see |e\.g\.|i\.e\.|https?:)/;

export function looksLikeCode(text: string): boolean {
  // Code quoted in backticks inside a sentence is documentation, not a leftover.
  const trimmed = text.replace(/`[^`]*`/g, '').trim();
  if (PROSE.test(trimmed) || isDirective(trimmed)) return false;
  if (trimmed.length < 3) return /^[)}\]]+;?$/.test(trimmed);
  if (readsAsProse(trimmed)) return false;
  return CODE_SHAPES.some((shape) => shape.test(trimmed));
}

export const cleanNoCommentedOutCode: Rule = {
  id: 'clean/no-commented-out-code',
  description: 'No code in comments. Version control remembers.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      let previous = -1;
      for (const comment of commentLines(file)) {
        if (comment.sample || !looksLikeCode(comment.text)) continue;
        // One report per run of consecutive lines: a commented-out block is one finding.
        if (comment.line !== previous + 1) {
          violations.push(
            report(
              { file: file.path, line: comment.line },
              `The comment holds code: "${comment.text.trim().slice(0, 60)}".`,
              'Delete it: version control keeps the old version, and code that does not run misleads the reader.',
            ),
          );
        }
        previous = comment.line;
      }
    }
    return violations;
  },
};

/** A sentence is mostly plain words; a statement is mostly identifiers glued to punctuation. */
function readsAsProse(text: string): boolean {
  const tokens = text.split(/\s+/);
  const words = tokens.filter((token) => /^[A-Za-z'`-]+[,.:;!?]?$/.test(token));
  return tokens.length >= 5 && words.length / tokens.length >= 0.8;
}
