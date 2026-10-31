import type { Config } from '../config';
import { diEntry } from './di-entry';

const FROM_THE_ENTRY = new Set(['createApplication', 'createTestApplication']);

/** The import lines of `names`: what makes an application comes from the entry of the container, the rest from the package. */
export function diImports(config: Config, names: readonly string[]): string {
  const onEntry = names.filter((name) => FROM_THE_ENTRY.has(name));
  const shared = names.filter((name) => !FROM_THE_ENTRY.has(name));

  return [
    ...(shared.length === 0 ? [] : [`import { ${shared.join(', ')} } from '@ddd-ts-kit/di';`]),
    ...(onEntry.length === 0 ? [] : [`import { ${onEntry.join(', ')} } from '${diEntry(config)}';`]),
  ].join('\n');
}
