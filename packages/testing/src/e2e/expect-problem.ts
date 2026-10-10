import { deepStrictEqual } from 'node:assert';
import type { HttpResponse } from './http-response.js';

export interface ExpectedProblem {
  readonly status: number;
  /** The stable error code, when the answer must carry this one. */
  readonly code?: string;
}

export type ProblemDetails = Readonly<Record<string, unknown>>;

const PROBLEM_JSON = 'application/problem+json';

/**
 * Asserts an RFC 9457 answer: the status, on the response and in the document, the
 * `application/problem+json` content type and the `code` member. Returns the document.
 */
export function expectProblem(response: HttpResponse, expected: ExpectedProblem): ProblemDetails {
  const problem = isRecord(response.body) ? response.body : {};
  const code = (value: unknown): object => (expected.code === undefined ? {} : { code: value });

  deepStrictEqual(
    {
      status: response.status,
      contentType: mediaTypeOf(response),
      problem: { status: problem.status, ...code(problem.code) },
    },
    {
      status: expected.status,
      contentType: PROBLEM_JSON,
      problem: { status: expected.status, ...code(expected.code) },
    },
  );

  return problem;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mediaTypeOf(response: HttpResponse): string | undefined {
  return response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
}
