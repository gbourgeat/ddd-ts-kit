/** The most words a gist keeps. */
const MOST_WORDS = 12;

/** The fewest words a gist cut at a comma keeps. */
const FEWEST_WORDS = 6;

/**
 * The first words of a marker, which a report prints in place of its sentence (the file holds it
 * at that line): the text up to its first `:`, `;` or end of sentence outside code; a longer one is
 * cut at its first comma past six words outside parentheses, else after twelve words, before an
 * open parenthesis, `...` marking the cut.
 */
export function gistOf(text: string): string {
  const words = firstClause(text.trim()).split(/\s+/);

  if (words.length <= MOST_WORDS) {
    return words.join(' ');
  }

  const comma = words.findIndex(
    (word, index) => index >= FEWEST_WORDS - 1 && word.endsWith(',') && !insideParentheses(words.slice(0, index + 1)),
  );

  const kept = words.slice(0, comma !== -1 && comma < MOST_WORDS ? comma + 1 : MOST_WORDS);

  // A cut inside parentheses goes back to before them, and keeps what is outside.
  while (insideParentheses(kept) && kept.length > FEWEST_WORDS) {
    kept.pop();
  }

  return `${kept.join(' ').replace(/[,(]+$/, '')}...`;
}

/** The text up to its first `:`, `;` or `.` followed by a space, outside backquotes. */
function firstClause(text: string): string {
  let inCode = false;

  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);

    if (char === '`') {
      inCode = !inCode;
    } else if (!inCode && ':;.'.includes(char) && /^\s|^$/.test(text.slice(at + 1, at + 2))) {
      return text.slice(0, at);
    }
  }

  return text;
}

function insideParentheses(words: readonly string[]): boolean {
  const text = words.join(' ');

  return text.split('(').length > text.split(')').length;
}
