import type { Endpoint } from './endpoint';
import type { UseCase } from './use-case';

/** What a route answers when its use case succeeds: 200 to a query, 204 to a command that answers nothing, 201 to a POST that answers an identifier. */
export function successStatus(endpoint: Endpoint, useCase: UseCase): number {
  if (useCase.isQuery) {
    return 200;
  }

  if (!useCase.returnsId) {
    return 204;
  }

  return endpoint.method === 'POST' ? 201 : 200;
}
