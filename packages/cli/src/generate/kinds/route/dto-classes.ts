import type { Endpoint } from './endpoint.js';
import type { UseCase } from './use-case.js';

const WITH_BODY = ['POST', 'PUT', 'PATCH'];

/**
 * The class-validator classes a route reads and answers with, by the role each plays: one class
 * per file. An identifier answer is the `Accepted` schema of the platform when schemas are shared.
 */
export function dtoClasses(endpoint: Endpoint, useCase: UseCase, sharesAccepted: boolean): string[] {
  if (useCase.isSearch) {
    return ['line'];
  }

  return [
    ...(endpoint.parameters.length > 0 ? ['params'] : []),
    ...(WITH_BODY.includes(endpoint.method) ? ['body'] : []),
    ...(useCase.returnsId && !sharesAccepted ? ['accepted'] : []),
    ...(useCase.isQuery ? ['answer'] : []),
  ];
}
