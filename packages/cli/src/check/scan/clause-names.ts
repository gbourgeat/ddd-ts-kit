/** The local names an import clause binds, and the ones among them written `type X`. */
export interface ClauseNames {
  readonly names: string[];
  readonly typeNames: string[];
}

const IDENTIFIER = /^[\w$]+$/;

export function clauseNames(clause: string): ClauseNames {
  const braces = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';

  const named = braces
    .split(',')
    .map(namedBinding)
    .filter((binding) => IDENTIFIER.test(binding.local));

  return {
    names: [...defaultAndNamespaceNames(clause.replace(/\{[^}]*\}/, ' ')), ...named.map((binding) => binding.local)],
    typeNames: named.filter((binding) => binding.isType).map((binding) => binding.local),
  };
}

function namedBinding(part: string): { local: string; isType: boolean } {
  const trimmed = part.trim();
  const cleaned = trimmed.replace(/^type\s+/, '');

  return { local: /\bas\s+([\w$]+)$/.exec(cleaned)?.[1] ?? cleaned, isType: cleaned !== trimmed };
}

function defaultAndNamespaceNames(outsideBraces: string): string[] {
  return outsideBraces
    .split(',')
    .map((part) => /\*\s*as\s+([\w$]+)/.exec(part)?.[1] ?? part.trim())
    .filter((word) => IDENTIFIER.test(word) && word !== 'type');
}
