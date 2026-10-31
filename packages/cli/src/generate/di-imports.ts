import type { Config } from '../config';

const FROM_THE_ENTRY = new Set(['createApplication', 'createTestApplication']);

/** The entry point of `@ddd-ts-kit/di` that makes the applications of the project, the one of its container. */
export function diEntry(config: Config): string {
  return `@ddd-ts-kit/di/${config.stack.di}`;
}

/** The import lines of `names`: what makes an application comes from the entry of the container, the rest from the package. */
export function diImports(config: Config, names: readonly string[]): string {
  const onEntry = names.filter((name) => FROM_THE_ENTRY.has(name));
  const shared = names.filter((name) => !FROM_THE_ENTRY.has(name));

  return [
    ...(shared.length === 0 ? [] : [`import { ${shared.join(', ')} } from '@ddd-ts-kit/di';`]),
    ...(onEntry.length === 0 ? [] : [`import { ${onEntry.join(', ')} } from '${diEntry(config)}';`]),
  ].join('\n');
}
