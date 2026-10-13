const ASSIGNMENT =
  /(?<![\w$.])this\s*\.\s*[\w$]+(?:\s*(?:\.\s*[\w$]+|\[[^\]]*\]))*\s*(?:\*\*|>>>|<<|>>|&&|\|\||\?\?|[-+*/%&|^])?=(?![=>])/g;

const INCREMENT = /(?:\+\+|--)\s*this\s*\.|(?<![\w$.])this\s*\.\s*[\w$]+(?:\s*\.\s*[\w$]+)*\s*(?:\+\+|--)/g;

const MUTATOR =
  /(?<![\w$.])this\s*\.\s*[\w$]+(?:\s*\.\s*[\w$]+)*\s*\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin|set|add|delete|clear)\s*\(/g;

/** The offsets in `code` where something of `this` is written: an assignment, an increment or a mutating call. */
export function stateWrites(code: string, from: number, to: number): number[] {
  const body = code.slice(from, to);

  return [ASSIGNMENT, INCREMENT, MUTATOR]
    .flatMap((pattern) => [...body.matchAll(pattern)].map((match) => from + match.index))
    .sort((a, b) => a - b);
}
