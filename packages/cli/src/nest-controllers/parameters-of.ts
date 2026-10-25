const OPENING = '([{<';
const CLOSING = ')]}>';

/**
 * The parameters of a method as written, from the text of its signature (`issue(@Body() body: X,
 * actor: Actor): Promise<Y>`): what stands between its parentheses, cut at the commas that no
 * bracket holds. `code` is the same text with its comments and strings blanked, where the
 * brackets are counted.
 */
export function parametersOf(text: string, code: string): string[] {
  const open = code.indexOf('(');
  const parameters: string[] = [];
  let depth = 0;
  let from = open + 1;

  for (let at = from; open >= 0 && at < code.length; at += 1) {
    const char = code.charAt(at);

    if (depth === 0 && (char === ',' || char === ')')) {
      parameters.push(text.slice(from, at).trim());
      from = at + 1;

      if (char === ')') {
        break;
      }
    } else if (OPENING.includes(char)) {
      depth += 1;
    } else if (CLOSING.includes(char) && code.charAt(at - 1) !== '=') {
      depth -= 1;
    }
  }

  return parameters.filter((parameter) => parameter !== '');
}
