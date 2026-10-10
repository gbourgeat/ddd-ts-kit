import type { FixtureFiles } from './fixture-files.js';

export function withoutFile(files: FixtureFiles, removed: string): FixtureFiles {
  return Object.fromEntries(Object.entries(files).filter(([file]) => file !== removed));
}
