import fs from 'node:fs';
import path from 'node:path';
import type { Baseline } from './baseline';
import { parseBaseline } from './parse-baseline';

/** Where a project records the errors it already had, beside its config, in the shape of eslint-suppressions.json. */
export const BASELINE_FILE = 'ddd-ts-kit-baseline.json';

/** The baseline of the project, or nothing when it has none. */
export function readBaseline(root: string): Baseline | undefined {
  const file = path.join(root, BASELINE_FILE);

  return fs.existsSync(file) ? parseBaseline(fs.readFileSync(file, 'utf8')) : undefined;
}
