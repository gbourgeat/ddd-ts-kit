const OPENING = '([{<';
const CLOSING = ')]}>';

/** The parameters a class declares in its constructor, each as written; none when it has no constructor. */
export function constructorParameters(source: string): string[] {
  const start = /\bconstructor\s*\(/.exec(source);

  if (start === null) {
    return [];
  }

  const parameters: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of source.slice(start.index + start[0].length)) {
    if (character === ')' && depth === 0) {
      break;
    }

    depth += nesting(character);

    if (character === ',' && depth === 0) {
      parameters.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  return [...parameters, current].map((parameter) => parameter.trim()).filter((parameter) => parameter !== '');
}

function nesting(character: string): number {
  if (OPENING.includes(character)) {
    return 1;
  }

  return CLOSING.includes(character) ? -1 : 0;
}
