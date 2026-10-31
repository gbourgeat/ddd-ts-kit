<<<<<<< HEAD
import type { Config } from '../config';
import { diEntry } from './di-entry';
=======
/** The entry point of `@ddd-ts-kit/di` that makes the applications of the project. */
const APPLICATION_ENTRY = '@ddd-ts-kit/di/tsyringe';
>>>>>>> origin/main

const FROM_THE_ENTRY = new Set(['createApplication', 'createTestApplication']);

/** The import lines of `names`: what makes an application comes from the entry of the container, the rest from the package. */
<<<<<<< HEAD
export function diImports(config: Config, names: readonly string[]): string {
=======
export function diImports(names: readonly string[]): string {
>>>>>>> origin/main
  const onEntry = names.filter((name) => FROM_THE_ENTRY.has(name));
  const shared = names.filter((name) => !FROM_THE_ENTRY.has(name));

  return [
    ...(shared.length === 0 ? [] : [`import { ${shared.join(', ')} } from '@ddd-ts-kit/di';`]),
<<<<<<< HEAD
    ...(onEntry.length === 0 ? [] : [`import { ${onEntry.join(', ')} } from '${diEntry(config)}';`]),
=======
    ...(onEntry.length === 0 ? [] : [`import { ${onEntry.join(', ')} } from '${APPLICATION_ENTRY}';`]),
>>>>>>> origin/main
  ].join('\n');
}
