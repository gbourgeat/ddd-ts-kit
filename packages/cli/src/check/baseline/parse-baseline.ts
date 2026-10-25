import { CliError } from '../../cli-error';
import type { Baseline, BaselineEntry } from './baseline';

/** The baseline a text holds: each file maps each rule id to a positive count. */
export function parseBaseline(text: string): Baseline {
  const parsed: unknown = JSON.parse(text);

  if (!isBaseline(parsed)) {
    throw new CliError(
      'ddd-ts-kit-baseline.json is not a baseline: each file maps each rule id to { "count": <n> }.',
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
