import { describe, expect, it } from '{{tests.module}}';
import { ForbiddenError, type GuardRequest } from '@ddd-ts-kit/http';
import { anonymousActor, executionContext } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Guard } from '{{alias.context}}/presentation/http/guards/{{name.kebab}}.guard{{alias.ext}}';

const actor = { id: 'user-1', type: 'user', roles: [], attributes: {} } as const;
const execution = executionContext({ correlationId: 'correlation-1', actor, origin: 'http' });

const request: GuardRequest = {
  method: 'GET',
  path: '/',
  operationId: 'anOperation',
  params: {},
  headers: {},
  actor,
  context: { requestId: 'request-1', execution, raw: undefined },
};

describe('{{name.pascal}}Guard', () => {
  it('refuses a caller with 403', () => {
    expect(() => new {{name.pascal}}Guard().check(request)).toThrow(ForbiddenError);
    expect(anonymousActor().type).toBe('anonymous');
  });

  // TODO(domain): replace the test above by one per decision of the guard.
  it.todo('lets through the caller it is written for');
});
