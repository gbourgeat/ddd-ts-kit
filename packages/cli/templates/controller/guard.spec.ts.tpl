import { describe, expect, it } from '{{tests.module}}';
import { anActor } from '@ddd-ts-kit/auth/testing';
import type { GuardRequest } from '@ddd-ts-kit/http';
import { type Actor, executionContext } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Guard } from '{{alias.context}}/presentation/http/guards/{{name.kebab}}.guard{{alias.ext}}';

describe('Who may pass the {{name.words}} guard', () => {
  it('refuses a caller with 403', () => {
    const request = requestOf(anActor().build());

    expect(() => new {{name.pascal}}Guard().check(request)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  // TODO(domain): the stub refuses every caller who has an id, so the one case it lets through is a caller without one. Replace both tests by one per decision of the guard.
  it('lets through a caller the stub does not refuse', () => {
    const request = requestOf(anActor().named('').build());

    expect(refusalOf(request)).toBeUndefined();
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

function refusalOf(request: GuardRequest): unknown {
  try {
    new {{name.pascal}}Guard().check(request);

    return undefined;
  } catch (refusal) {
    return refusal;
  }
}
