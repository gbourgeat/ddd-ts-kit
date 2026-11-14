import type { Settled } from './merge-report';

/** The sentences of what was settled, as entries of the report: the file named from the top of the repository, as every other entry. */
export function asSettled(said: readonly string[], { file, index }: { file: string; index: string }): Settled[] {
  return said.map((sentence) => ({
    file,
    kind: 'registry',
    how: sentence.startsWith(index) ? sentence.slice(index.length).replace(/^:? /, '') : sentence,
  }));
}
