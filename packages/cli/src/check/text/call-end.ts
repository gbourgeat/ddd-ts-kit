/** Offset just after the parenthesis closing the call whose arguments start at `open`. */
export function callEnd(code: string, open: number): number {
  let depth = 1;

  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') {
      depth += 1;
    }

    if (code[i] === ')') {
      depth -= 1;
    }

    if (depth === 0) {
      return i + 1;
    }
  }

  return code.length;
}
