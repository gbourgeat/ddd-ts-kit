import { ValidationError, type ValidationIssue } from '@ddd-ts-kit/validation';
import type { Route } from '../route/route';
import type { RawRequest } from './raw-request';

type Part = 'params' | 'query' | 'headers' | 'body';

type ValidatedRequest = Record<Part, unknown>;

interface Reading {
  readonly route: Route;
  readonly request: RawRequest;
  readonly issues: ValidationIssue[];
}

/** Every part through its schema; the issues of all parts are reported together. */
export function validateRequest(route: Route, request: RawRequest): ValidatedRequest {
  const reading: Reading = { route, request, issues: [] };

  const input = {
    params: parsePart(reading, 'params'),
    query: parsePart(reading, 'query'),
    headers: parsePart(reading, 'headers'),
    body: parsePart(reading, 'body'),
  };

  if (reading.issues.length > 0) {
    throw new ValidationError(reading.issues, 'The request is not valid.');
  }

  return input;
}

function parsePart({ route, request, issues }: Reading, part: Part): unknown {
  const schema = route.request?.[part];

  if (schema === undefined) {
    return request[part];
  }

  const result = schema.parse(request[part]);

  if (result.ok) {
    return result.value;
  }

  for (const issue of result.error) {
    issues.push({ ...issue, path: issue.path === '' ? part : `${part}.${issue.path}` });
  }

  return undefined;
}
