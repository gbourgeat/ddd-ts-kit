/** `--aggregate Invoice`, the aggregate a command or a query works on. */
const OPTION = /--aggregate[ =]+([A-Za-z][\w]*)/g;

/** `aggregate billing Invoice`, `repository billing Invoice`: the generators of an aggregate and of its repository. */
const GENERATOR = /(?<![-\w])(?:aggregate|repository)\s+[a-z][\w-]*\s+([A-Z]\w*)/g;

/**
 * The aggregates the generator commands of a `Start with` cell name, sorted, each once. Empty when
 * the cell names none: the files the row touches are then unknown, not shared with nobody.
 */
export function aggregatesOf(startWith: string): string[] {
  const named = [...startWith.matchAll(OPTION), ...startWith.matchAll(GENERATOR)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

  return [...new Set(named)].sort();
}
