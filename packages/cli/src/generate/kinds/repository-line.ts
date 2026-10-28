import type { Name } from '../../naming';

/** The start of the line that creates the repository of an aggregate in a hand-wired module file. */
export function repositoryLine(aggregate: Name): string {
  return `const ${aggregate.camel}Repository =`;
}
