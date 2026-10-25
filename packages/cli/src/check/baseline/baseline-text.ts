import { formatJson } from '../../json/format-json';
import type { Baseline, BaselineEntry } from './baseline';

/** The baseline as written, its files and rules in order, so that a change of it reads as a diff. */
export function baselineText(baseline: Baseline): string {
  const ordered = Object.fromEntries(
    Object.keys(baseline)
      .sort()
      .map((file) => [file, Object.fromEntries(Object.entries(baseline[file] ?? {}).sort(byKey))]),
  );

  return formatJson(ordered);
}

function byKey([one]: [string, BaselineEntry], [other]: [string, BaselineEntry]): number {
  return one.localeCompare(other);
}
