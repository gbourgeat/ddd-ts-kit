import { isDirective } from './is-directive.js';

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

  if (PROSE.test(trimmed) || isDirective(trimmed)) {
    return false;
  }

  if (trimmed.length < 3) {
    return /^[)}\]]+;?$/.test(trimmed);
  }

  if (readsAsProse(trimmed)) {
    return false;
  }

  return CODE_SHAPES.some((shape) => shape.test(trimmed));
}

/** A sentence is mostly plain words; a statement is mostly identifiers glued to punctuation. */
function readsAsProse(text: string): boolean {
  const tokens = text.split(/\s+/);
  const words = tokens.filter((token) => /^[A-Za-z'`-]+[,.:;!?]?$/.test(token));

  return tokens.length >= 5 && words.length / tokens.length >= 0.8;
}
