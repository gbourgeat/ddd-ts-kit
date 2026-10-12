import { ConceptError, DomainError, type RefusalFacts } from '@ddd-ts-kit/kernel';
import { ValidationError } from '@ddd-ts-kit/validation';
import type { ErrorMapper } from './error-mapper.js';
import { INTERNAL_ERROR_CODE } from './internal-error-code.js';
import type { Problem } from './problem.js';
import { statusTitle } from './status-title.js';

export function toProblem(error: unknown, mapper: ErrorMapper, requestId: string): Problem {
  if (!(error instanceof DomainError)) {
    return internalProblem(requestId);
  }

  const status = mapper.statusOf(error.code);

  if (status >= 500) {
    // A domain error mapped to a server fault is no longer the client's business.
    return { ...internalProblem(requestId), status, title: statusTitle(status), code: error.code };
  }

  return {
    type: mapper.typeOf(error.code),
    title: statusTitle(status),
    status,
    code: error.code,
    detail: error.message,
    ...(error instanceof ValidationError ? { issues: error.issues } : {}),
    ...exposedFacts(error),
    requestId,
  };
}

/** Only what the factory of the refusal exposed by name: a fact never leaves the process by default. */
function exposedFacts(error: DomainError): { facts?: RefusalFacts } {
  if (!(error instanceof ConceptError)) {
    return {};
  }

  const facts = error.exposedFacts;

  return Object.keys(facts).length === 0 ? {} : { facts };
}

// The message of an unexpected error quotes data and internals: it never leaves the process.
function internalProblem(requestId: string): Problem {
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: INTERNAL_ERROR_CODE,
    requestId,
  };
}
