/**
 * The part of a test runner the suites use, passed in so that this module imports no runner.
 * The globals of vitest and jest both fit: `{ describe, it, expect, beforeEach }`.
 */
export interface ContractRunner {
  describe(name: string, suite: () => void): unknown;
  it(name: string, test: () => Promise<void>): unknown;
  beforeEach(setup: () => Promise<void>): unknown;
  /** Optional: when given, subjects exposing `close()` are closed after each test. */
  afterEach?(teardown: () => Promise<void>): unknown;
  expect(actual: unknown): { toBe(expected: unknown): unknown; toEqual(expected: unknown): unknown };
}
