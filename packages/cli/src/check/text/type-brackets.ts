/**
 * How a character moves the nesting of a type read as text: brackets and angle brackets, the `>`
 * of an arrow `=>` left out. `previous` is the character before it.
 */
export function typeBrackets(char: string, previous: string): number {
  if ('([{<'.includes(char)) {
    return 1;
  }

  return ')]}'.includes(char) || (char === '>' && previous !== '=') ? -1 : 0;
}
