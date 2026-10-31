import { outerEntry } from './outer-entry';
import { outsideConcern } from './outside-concern';

/** A package imported by an inner layer: its name and the entry written in the import. */
export interface ImportedPackage {
  readonly name: string;
  readonly specifier: string;
}

export interface PackageJudgment {
  readonly messageId: 'outsideConcern' | 'entry' | 'package';
  readonly data: Readonly<Record<string, string>>;
}

/**
 * What an inner layer (`importer`) is told about a package it imports: an outside concern
 * whatever the allow-list says, a package outside the list, an outer entry of an allowed one.
 */
export function judgePackage(
  importer: string,
  { name, specifier }: ImportedPackage,
  allowed: readonly string[],
): PackageJudgment | undefined {
  const concern = outsideConcern(name);

  if (concern !== undefined) {
    return { messageId: 'outsideConcern', data: { importer, specifier, ...concern } };
  }

  if (!allowed.includes(name)) {
    return { messageId: 'package', data: { name } };
  }

  const what = outerEntry(specifier, allowed);

  return what === undefined ? undefined : { messageId: 'entry', data: { importer, specifier, what, name } };
}
