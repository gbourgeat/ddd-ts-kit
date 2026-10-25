import fs from 'node:fs';
import path from 'node:path';
import { formatJson } from '../../json/format-json';
import type { Baseline, BaselineEntry } from './baseline';
import { BASELINE_FILE } from './read-baseline';

/** Writes the baseline, its files and rules in order, so that a change of it reads as a diff. */
export function writeBaseline(root: string, baseline: Baseline): void {
  const ordered = Object.fromEntries(
    Object.keys(baseline)
      .sort()
      .map((file) => [file, Object.fromEntries(Object.entries(baseline[file] ?? {}).sort(byKey))]),
  );

  fs.writeFileSync(path.join(root, BASELINE_FILE), formatJson(ordered));
}

function byKey([one]: [string, BaselineEntry], [other]: [string, BaselineEntry]): number {
  return one.localeCompare(other);
}
