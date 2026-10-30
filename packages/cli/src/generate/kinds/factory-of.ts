/** Where the birth factory of a generated aggregate starts, and where its body closes. */
const OPENING = /\bstatic create\(/;
const CLOSING = '\n  }\n';

/** The text of `static create(...) { ... }` of an aggregate, from its signature to its closing brace; undefined when it has none. */
export function factoryOf(source: string): string | undefined {
  const start = OPENING.exec(source)?.index;

  if (start === undefined) {
    return undefined;
  }

  const end = source.indexOf(CLOSING, start);

  return end === -1 ? source.slice(start) : source.slice(start, end + CLOSING.length);
}
