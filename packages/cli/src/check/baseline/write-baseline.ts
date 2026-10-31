import { writeInsideProject } from '../../workspace/write-inside-project';
import type { Baseline } from './baseline';
import { baselineText } from './baseline-text';
import { BASELINE_FILE } from './read-baseline';

/** Writes the baseline of the project beside its config. */
export function writeBaseline(root: string, baseline: Baseline): void {
  writeInsideProject(root, BASELINE_FILE, baselineText(baseline));
}
