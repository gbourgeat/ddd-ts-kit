import type { FixtureFiles } from './fixture-files';

/**
 * The list of the read model tables of a fixture whose subject is another rule: each store of
 * billing it holds is left out by a comment, so that `persistence/read-model-listed` says nothing.
 */
export function readModelListFiles(...stores: readonly string[]): FixtureFiles {
  const leftOut = stores.map((store) => `  // billing: ${store}, left out: the fixture keeps no table`);

  return {
    'src/platform/database/read-model-tables.ts': ['export const LISTED = [', ...leftOut, '];', ''].join('\n'),
  };
}
