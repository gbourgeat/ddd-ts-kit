import { deepStrictEqual } from 'node:assert';
import type { HttpResponse } from './http-response';

export interface ExpectedProblem {
  readonly status: number;
  /** The stable error code, when the answer must carry this one. */
  readonly code?: string;
  /** The facts the document must expose under `facts`, by name, as JSON writes them. It may expose others. */
  readonly facts?: Readonly<Record<string, unknown>>;
}

export type ProblemDetails = Readonly<Record<string, unknown>>;

const PROBLEM_JSON = 'application/problem+json';

/**
 * Asserts an RFC 9457 answer: the status, on the response and in the document, the
 * `application/problem+json` content type, the `code` member and, when given, the exposed
 * `facts`. Returns the document.
 */
export function expectProblem(response: HttpResponse, expected: ExpectedProblem): ProblemDetails {
  const problem = isRecord(response.body) ? response.body : {};
  const code = (value: unknown): object => (expected.code === undefined ? {} : { code: value });
  const exposed = isRecord(problem.facts) ? problem.facts : {};
  const names = Object.keys(expected.facts ?? {});

  deepStrictEqual(
    {
      status: response.status,
      contentType: mediaTypeOf(response),
      problem: { status: problem.status, ...code(problem.code), ...facts(names, exposed) },
    },
    {
      status: expected.status,
      contentType: PROBLEM_JSON,
      problem: { status: expected.status, ...code(expected.code), ...facts(names, expected.facts ?? {}) },
    },
  );

  return problem;
}

/** The named facts alone, so that the comparison shows the ones that differ and no other. */
function facts(names: readonly string[], source: Readonly<Record<string, unknown>>): object {
  return names.length === 0 ? {} : { facts: Object.fromEntries(names.map((name) => [name, source[name]])) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mediaTypeOf(response: HttpResponse): string | undefined {
  return response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
}
