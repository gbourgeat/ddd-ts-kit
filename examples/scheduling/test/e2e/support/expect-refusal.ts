import { expect } from 'vitest';
import type { Answered } from '$test/e2e/support/answered';

type Refusal<Result> = Extract<Result, { readonly ok: false; readonly problem: { readonly code: unknown } }>;

/**
 * Asserts that the API refused with a status and a code its contract declares for that status:
 * the compiler refuses a code the operation cannot answer, the assertion one it did not.
 */
export function expectRefusal<Result extends Answered, Status extends Refusal<Result>['status']>(
  result: Result,
  status: Status,
  code: Extract<Refusal<Result>, { readonly status: Status }>['problem']['code'],
): void {
  expect(result).toMatchObject({ ok: false, status, problem: { status, code } });
}
