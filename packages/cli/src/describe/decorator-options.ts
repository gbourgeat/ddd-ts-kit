/** The text between the parentheses of the first `@<name>(...)` of a source, or undefined when it carries none. */
export function decoratorOptions(source: string, name: string): string | undefined {
  const written = new RegExp(String.raw`@${name}\s*\(`).exec(source);

  if (written === null) {
    return undefined;
  }

  const open = written.index + written[0].length;
  let depth = 1;

  for (let at = open; at < source.length; at += 1) {
    const char = source.charAt(at);

    if (char === '(') {
      depth += 1;
    } else if (char === ')' && (depth -= 1) === 0) {
      return source.slice(open, at);
    }
  }

  return undefined;
}
