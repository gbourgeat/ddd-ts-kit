/** An entry of `entities` as the kit reads and writes it: a bare name, a comma, blanks around either. */
const ENTRY = /^[ \t]*([\w$]+)[ \t]*,[ \t]*$/;

/**
 * The name a line of the region of the entities lists, or undefined when it is no entry the kit
 * writes. What the kit accepts as its own and what it takes out are read here alike.
 */
export function entryOf(line: string): string | undefined {
  return ENTRY.exec(line)?.[1];
}
