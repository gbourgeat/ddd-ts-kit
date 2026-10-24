import { expect } from 'vitest';
import type { CliResult } from '../helpers';

/** A command of the CLI that succeeded, its error output shown otherwise. */
export function expectOk(result: CliResult): CliResult {
  expect(result.code, result.stderr).toBe(0);

  return result;
}
