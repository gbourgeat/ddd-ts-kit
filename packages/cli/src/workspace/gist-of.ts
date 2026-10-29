/** The most words a gist keeps. */
const MOST_WORDS = 12;

/** The fewest words a gist cut at a comma keeps. */
const FEWEST_WORDS = 6;

/** The abbreviations whose period ends no sentence. */
const ABBREVIATIONS = new Set(['e.g.', 'i.e.', 'etc.', 'vs.', 'cf.']);

/**
 * The first words of a marker, which a report prints in place of its sentence (the file holds it
 * at that line): the text up to its first `:`, `;` or end of sentence outside code; a longer one is
 * cut at its first comma past six words outside parentheses, else after twelve words. A gist never
 * ends inside parentheses: it goes back before the one left open, keeping at least its first word.
 * `...` marks a cut.
 */
export function gistOf(text: string): string {
  const words = firstClause(text.trim()).split(/\s+/);
  const kept = words.length <= MOST_WORDS ? [...words] : cutAtComma(words);

  while (insideParentheses(kept) && kept.length > 1) {
    kept.pop();
  }

  return kept.length < words.length ? `${kept.join(' ').replace(/[,(]+$/, '')}...` : kept.join(' ');
}

/** The words up to the first comma past six words outside parentheses, else the first twelve. */
function cutAtComma(words: readonly string[]): string[] {
  const comma = words.findIndex(
    (word, index) => index >= FEWEST_WORDS - 1 && word.endsWith(',') && !insideParentheses(words.slice(0, index + 1)),
  );

  return words.slice(0, comma !== -1 && comma < MOST_WORDS ? comma + 1 : MOST_WORDS);
}

/** The text up to its first `:`, `;` or `.` followed by a space, outside backquotes, past an abbreviation. */
function firstClause(text: string): string {
  let inCode = false;

  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);

    if (char === '`') {
      inCode = !inCode;
    } else if (!inCode && ':;.'.includes(char) && /^\s|^$/.test(text.slice(at + 1, at + 2)) && !abbreviated(text, at)) {
      return text.slice(0, at);
    }
  }

  return text;
}

/** Whether the period at `at` closes an abbreviation (`e.g.`, `etc.`) or a one-letter segment (`b.`). */
function abbreviated(text: string, at: number): boolean {
  if (text.charAt(at) !== '.') {
    return false;
  }

  const before = text.slice(0, at + 1).split(/\s/);
  const word = before.at(-1) ?? '';
  const segment = word.slice(0, -1).split('.').at(-1) ?? '';

  return ABBREVIATIONS.has(word.toLowerCase()) || segment.length === 1;
}

function insideParentheses(words: readonly string[]): boolean {
  const text = words.join(' ');

  return text.split('(').length > text.split(')').length;
}
