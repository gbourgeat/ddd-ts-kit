import { AssertionError } from 'node:assert';
import { inspect } from 'node:util';
import type { HttpResponse } from './http-response';

/**
 * Asserts the status and hands the response back. On a mismatch the failure shows the body,
 * which is where an API says why it refused: use it for every arrangement made through HTTP.
 */
export function expectStatus<Body>(response: HttpResponse<Body>, status: number): HttpResponse<Body> {
  if (response.status !== status) {
    throw new AssertionError({
      message: `Expected status ${status}, received ${response.status} with body ${inspect(response.body, { depth: 6 })}`,
      actual: response.status,
      expected: status,
      operator: 'strictEqual',
    });
  }

  return response;
}
