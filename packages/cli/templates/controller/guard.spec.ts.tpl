import { describe, expect, it } from '{{tests.module}}';
import { anActor } from '@ddd-ts-kit/auth/testing';
import type { GuardRequest } from '@ddd-ts-kit/http';
import { type Actor, executionContext } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Guard } from '{{alias.context}}/presentation/http/guards/{{name.kebab}}.guard{{alias.ext}}';

describe('Who may pass the {{name.words}} guard', () => {
  // TODO(domain): the stub refuses everybody. Once the control is written, hold one test per decision of the guard: who it lets through, who it refuses with 403.
  it('refuses a caller with 403', () => {
    const request = requestOf(anActor().build());

    expect(() => new {{name.pascal}}Guard().check(request)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it.todo('lets through the caller it is written for');
});

function requestOf(actor: Actor): GuardRequest {
  return {
    method: 'GET',
    path: '/',
    operationId: 'anOperation',
    params: {},
    headers: {},
    actor,
    context: {
      requestId: 'request-1',
      execution: executionContext({ correlationId: 'correlation-1', actor, origin: 'http' }),
      raw: undefined,
    },
  };
}
