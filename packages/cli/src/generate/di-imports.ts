/** The entry point of `@ddd-ts-kit/di` that makes the applications of the project. */
const APPLICATION_ENTRY = '@ddd-ts-kit/di/tsyringe';

const FROM_THE_ENTRY = new Set(['createApplication', 'createTestApplication']);

/** The import lines of `names`: what makes an application comes from the entry of the container, the rest from the package. */
export function diImports(names: readonly string[]): string {
  const onEntry = names.filter((name) => FROM_THE_ENTRY.has(name));
  const shared = names.filter((name) => !FROM_THE_ENTRY.has(name));

  return [
    ...(shared.length === 0 ? [] : [`import { ${shared.join(', ')} } from '@ddd-ts-kit/di';`]),
    ...(onEntry.length === 0 ? [] : [`import { ${onEntry.join(', ')} } from '${APPLICATION_ENTRY}';`]),
  ].join('\n');
}
