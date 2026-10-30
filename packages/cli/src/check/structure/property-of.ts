/** A property of a class as its declaration reads: its name, whether it is optional, whether it is given a value. */
export interface Property {
  readonly name: string;
  readonly optional: boolean;
  readonly initialized: boolean;
}

/** The modifiers a property may carry before its name, in any order, then its name, its mark and what follows. */
const PROPERTY =
  /^(?:(?:public|protected|private|readonly|declare|override)\s+)*([A-Za-z_$][\w$]*)\s*([?!])?\s*([:=;]|$)/;

/** An `=` that gives a value: neither part of `=>`, `==`, `<=`, `>=` nor `!=`. */
const ASSIGNMENT = /(?<![=!<>])=(?![=>])/;

/**
 * The property a declaration of a class body declares, its decorators already read: `name`,
 * `declare name: string`, `public readonly name?: string`, `name = ''`. Nothing for a method, an
 * accessor, a static member or anything else.
 */
export function propertyOf(declaration: string): Property | undefined {
  const trimmed = declaration.trim();
  const match = PROPERTY.exec(trimmed);
  const name = match?.[1];

  if (match === null || name === undefined) {
    return undefined;
  }

  return {
    name,
    optional: match[2] === '?',
    initialized: match[3] === '=' || (match[3] === ':' && ASSIGNMENT.test(trimmed.slice(match[0].length))),
  };
}
