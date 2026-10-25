import fs from 'node:fs';
import path from 'node:path';
import type { Baseline } from './baseline';
import { baselineText } from './baseline-text';
import { BASELINE_FILE } from './read-baseline';

/** Writes the baseline of the project beside its config. */
export function writeBaseline(root: string, baseline: Baseline): void {
  fs.writeFileSync(path.join(root, BASELINE_FILE), baselineText(baseline));
}
