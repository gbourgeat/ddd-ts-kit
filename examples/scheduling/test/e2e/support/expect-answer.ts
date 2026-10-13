import { expect } from 'vitest';
import type { Answered } from '$test/e2e/support/answered';

type Answer<Result, Status> = Extract<Result, { readonly ok: true; readonly status: Status; readonly data: unknown }>;

/** Asserts that the API answered a success with a status its contract declares, and gives its body, typed. */
export function expectAnswer<Result extends Answered, Status extends Answer<Result, number>['status']>(
  result: Result,
  status: Status,
): Answer<Result, Status>['data'] {
  expect(result).toMatchObject({ ok: true, status });

  if (!isAnswer(result, status)) {
    throw new Error(`The API answered ${result.status}, not ${status}.`);
  }

  return result.data;
}

function isAnswer<Result extends Answered, Status extends number>(
  result: Result,
  status: Status,
): result is Answer<Result, Status> & Result {
  return result.ok && result.status === status;
}
