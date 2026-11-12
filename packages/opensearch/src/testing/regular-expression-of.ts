const SYNTAX = /[.*+?^${}()|[\]\\]/g;
const SYNTAX_IN_A_LIST = /[\]\\^-]/g;

/**
 * A regular expression of Lucene, as far as the store writes one: `.` any character, `*` any run
 * of what precedes, `[...]` one character of a list, `\` before a character that then matches
 * itself. It matches the whole value, as in an index.
 */
export function regularExpressionOf(pattern: string): RegExp {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? '';

    if (character === '\\') {
      index += 1;
      source += literal(pattern[index] ?? '');
    } else if (character === '[') {
      const end = pattern.indexOf(']', index);

      source += `[${pattern.slice(index + 1, end).replace(SYNTAX_IN_A_LIST, '\\$&')}]`;
      index = end;
    } else {
      source += character === '.' ? '[\\s\\S]' : character === '*' ? '*' : literal(character);
    }
  }

  return new RegExp(`^${source}$`, 'u');
}

function literal(text: string): string {
  return text.replace(SYNTAX, '\\$&');
}
