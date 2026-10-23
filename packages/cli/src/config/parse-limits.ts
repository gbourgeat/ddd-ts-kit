import type { Limits } from './config';
import { FUNCTION_LINES_CEILING } from './function-lines-ceiling';
import { isRecord } from './values/is-record';

const DEFAULT_LIMITS: Limits = { maxParameters: 3, maxFunctionLines: 30 };

export function parseLimits(value: unknown): Limits {
  const raw = isRecord(value) ? value : {};

  return {
    maxParameters: positive(raw['maxParameters'], DEFAULT_LIMITS.maxParameters),
    maxFunctionLines: Math.min(
      positive(raw['maxFunctionLines'], DEFAULT_LIMITS.maxFunctionLines),
      FUNCTION_LINES_CEILING,
    ),
  };
}

function positive(candidate: unknown, fallback: number): number {
  return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0 ? candidate : fallback;
}
