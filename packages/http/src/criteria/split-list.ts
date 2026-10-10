/** The values of a comma-separated list. A comma inside a value is written `\,`, a backslash `\\`. */
export function splitList(text: string): string[] {
  const values = [''];

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    const escaped = character === '\\' && index + 1 < text.length;

    if (character === ',') {
      values.push('');
    } else {
      values[values.length - 1] += escaped ? text.charAt(index + 1) : character;
    }

    if (escaped) {
      index += 1;
    }
  }

  return values;
}
