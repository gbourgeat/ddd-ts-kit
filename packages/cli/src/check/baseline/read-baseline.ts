import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error';
import type { Baseline, BaselineEntry } from './baseline';

/** Where a project records the errors it already had, beside its config, in the shape of eslint-suppressions.json. */
export const BASELINE_FILE = 'ddd-ts-kit-baseline.json';

/** The baseline of the project, or nothing when it has none. */
export function readBaseline(root: string): Baseline | undefined {
  const file = path.join(root, BASELINE_FILE);

  if (!fs.existsSync(file)) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (!isBaseline(parsed)) {
    throw new CliError(
      `${BASELINE_FILE} is not a baseline: each file maps each rule id to { "count": <n> }.`,
      'Write it again with `ddd-ts-kit check --baseline write`.',
    );
  }

  return parsed;
}

function isBaseline(value: unknown): value is Baseline {
  return (
    isObject(value) && Object.values(value).every((rules) => isObject(rules) && Object.values(rules).every(isEntry))
  );
}

function isEntry(value: unknown): value is BaselineEntry {
  return isObject(value) && Number.isInteger(value['count']) && Number(value['count']) > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
