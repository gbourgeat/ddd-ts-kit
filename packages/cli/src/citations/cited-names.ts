import { isContextRelative } from '../check/canonical/is-context-relative.js';
import { splitWords } from '../naming/split-words.js';
import type { CitedKind, CitedName } from './cited-name.js';
import type { DocumentPart, PartText } from './document-part.js';

/** What a part is read against: the source root, and the terms of the glossary of its context, in lower case without spaces. */
export interface Vocabulary {
  readonly sourceRoot: string;
  readonly terms: ReadonlySet<string>;
}

interface Span {
  readonly value: string;
  readonly offset: number;
}

/** Words of a sentence telling that a name in it is history: what the code had, not what to build. */
const HISTORY =
  /\b(?:removed|deleted|gone|renamed|replaced|dropped|retired|superseded|obsolete|no longer|instead of)\b/i;

/** A plain path of a file or a directory, with no placeholder (`<name>`, `*`). */
const PLAIN_PATH = /^[\w$@.-]+(?:\/[\w$@.-]+)*\/?$/;

/** `Calendar.slotFor`: a PascalCase name with a lower-case letter, a dot, a camelCase member that is no file extension. */
const MEMBER =
  /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*\.(?!(?:md|ts|js|mjs|cjs|json|ya?ml|sql|txt|html?|css)$)[a-z][A-Za-z0-9]*$/;

const SYMBOL = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/;
const SENTENCE_END = /[.!?;](?=\s|$)/g;

/**
 * The names a part cites as inline code, fenced blocks left out: paths under the source root
 * or relative to a context, `Class.member`, and PascalCase names (one word only when it is not
 * a term of the glossary). A span with a space (a generator command, a sentence) names nothing.
 */
export function citedNames(part: DocumentPart, vocabulary: Vocabulary): CitedName[] {
  return part.texts.flatMap((text) => namesIn(text, vocabulary));
}

function namesIn({ line, text }: PartText, vocabulary: Vocabulary): CitedName[] {
  return spansOf(text).flatMap(({ value, offset }) => {
    const cited = cleaned(value);
    const kind = kindOf(cited, vocabulary);

    if (kind === undefined) {
      return [];
    }

    const recorded = HISTORY.test(sentenceAt(text, offset));

    return [{ cited, kind, line: line + (text.slice(0, offset).match(/\n/g) ?? []).length, recorded }];
  });
}

/** The closed inline code spans of a text, each with where its content starts. */
function spansOf(text: string): Span[] {
  const pieces = text.split('`');
  const starts = pieces.map((_, index) => pieces.slice(0, index).reduce((sum, piece) => sum + piece.length + 1, 0));

  return pieces.flatMap((piece, index) => {
    const closed = index % 2 === 1 && index < pieces.length - 1;

    return closed && piece !== '' && !/\s/.test(piece) ? [{ value: piece, offset: starts[index] ?? 0 }] : [];
  });
}

function cleaned(span: string): string {
  return span
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/\(\)$/, '')
    .replace(/^([\w.]+)<.*>$/, '$1');
}

function kindOf(cited: string, vocabulary: Vocabulary): CitedKind | undefined {
  if (isPath(cited, vocabulary.sourceRoot)) {
    return 'path';
  }

  if (MEMBER.test(cited)) {
    return 'member';
  }

  if (!SYMBOL.test(cited)) {
    return undefined;
  }

  return splitWords(cited).length > 1 || !vocabulary.terms.has(cited.toLowerCase()) ? 'symbol' : undefined;
}

function isPath(cited: string, sourceRoot: string): boolean {
  const named = cited.endsWith('.ts') || cited.endsWith('/');

  return isContextRelative(cited) || (cited.startsWith(`${sourceRoot}/`) && PLAIN_PATH.test(cited) && named);
}

/**
 * The prose of the sentence of a text around an offset, from the end of the previous one to the
 * end of its own, its code spans left out: `.member-removed` is a name, not a word of the sentence.
 */
function sentenceAt(text: string, offset: number): string {
  const ends = [...text.matchAll(SENTENCE_END)].map((end) => end.index);
  const start = Math.max(0, ...ends.filter((end) => end < offset).map((end) => end + 1));
  const end = ends.find((index) => index >= offset);

  return text.slice(start, end).replace(/`[^`]*`/g, ' ');
}
