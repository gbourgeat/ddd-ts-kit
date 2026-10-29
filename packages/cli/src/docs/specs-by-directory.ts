import type { PageSection, SpecOfPage } from './page-section';
import { specHeading } from './spec-heading';

/** The directories of tests whose specs come first, in the order of the page; any other directory of specs follows, sorted. */
const FIRST = ['unit', 'integration'];
/** The heading of a directory of specs whose name is not a word. */
const TITLES: Readonly<Record<string, string>> = { e2e: 'End-to-end specs' };

/**
 * Specs under the heading of the directory they are in, from the directory the page reads, each under
 * a heading of its own: `unit` and `integration` first, those at its root last.
 */
export function specsByDirectory(specs: readonly SpecOfPage[]): PageSection[] {
  const byDirectory = new Map<string, SpecOfPage[]>();

  for (const spec of specs) {
    const slash = spec.file.indexOf('/');
    const directory = slash === -1 ? '' : spec.file.slice(0, slash);

    byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), spec]);
  }

  const named = [...byDirectory.keys()].filter((directory) => directory !== '').sort();

  return [
    ...FIRST.filter((directory) => named.includes(directory)),
    ...named.filter((directory) => !FIRST.includes(directory)),
    ...(byDirectory.has('') ? [''] : []),
  ].map((directory) => ({
    title: directory === '' ? 'Specs' : (TITLES[directory] ?? `${capitalised(directory)} specs`),
    entries: (byDirectory.get(directory) ?? []).map((spec) => ({ heading: specHeading(spec.file), specs: [spec] })),
  }));
}

function capitalised(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1).replaceAll('-', ' ')}`;
}
