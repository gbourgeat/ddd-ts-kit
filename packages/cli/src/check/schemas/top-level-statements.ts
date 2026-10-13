/** Splits a text on the separators met outside any bracket; empty parts are dropped. */
export function topLevelStatements(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);

    if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }

  return [...parts, text.slice(start)].map((part) => part.trim()).filter((part) => part !== '');
}
