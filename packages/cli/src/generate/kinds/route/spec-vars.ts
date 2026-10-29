import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Endpoint } from './endpoint';
import { sampleParams } from './sample-params';
import type { UseCase } from './use-case';

/** What a spec is written for: the route, the use case it calls and the status it answers when that succeeds. */
interface Specified {
  readonly name: Name;
  readonly endpoint: Endpoint;
  readonly useCase: UseCase;
  readonly status: number;
}

/**
 * What the spec of a route or a controller reads: one arrangement for all of them, a recording bus
 * that answers for the use case and `routeOf` of `@ddd-ts-kit/http/testing`, then the request sent,
 * the answer and the message handed to the use case asserted.
 */
export function specVars({ name, endpoint, useCase, status }: Specified): RenderContext {
  const bus = useCase.isQuery ? 'queries' : 'commands';
  const usesCaller = useCase.isProtected || useCase.isSearch;
  const caller = usesCaller ? ['caller'] : [];

  return {
    recordingBus: useCase.isQuery ? 'RecordingQueryBus' : 'RecordingCommandBus',
    recordingAnswer: answerOf(name, useCase),
    sentParts: ['route', ...caller, 'send'].join(', '),
    sentPartsOfRoute: [...caller, 'send'].join(', '),
    sentRequest: sentRequestOf(endpoint),
    answerExpectation: useCase.returnsId
      ? `expect(response).toMatchObject({ status: ${status}, body: { id: '${name.kebab}-1' } });`
      : `expect(response.status).toBe(${status});`,
    messageExpectation: useCase.isSearch
      ? `expect(${bus}.executed).toMatchObject([{ actor: caller }]);`
      : `expect(${bus}.executed).toEqual([new ${useCase.message}(${useCase.isProtected ? 'caller' : ''})]);`,
  };
}

/** What the recording bus answers the route: an identifier, a page, an empty answer, or nothing for a command that answers nothing. */
function answerOf(name: Name, useCase: UseCase): string {
  if (useCase.isSearch) {
    // Written open: the formatter keeps an object open once its first property stands on its own line.
    return `.answering(${useCase.message}, () => ({\n      items: [{ id: '${name.kebab}-1' }],\n      total: 1,\n    }))`;
  }

  if (useCase.isQuery) {
    return `.answering(${useCase.message}, () => ({}))`;
  }

  return useCase.returnsId ? `.answering(${useCase.message}, () => '${name.kebab}-1')` : '';
}

/** The request the spec sends: a sample of each path parameter, an empty body to a route that reads one. */
function sentRequestOf({ method, parameters }: Endpoint): string {
  const parts = [
    ...(parameters.length > 0 ? [`params: ${sampleParams(parameters)}`] : []),
    ...(['POST', 'PUT', 'PATCH'].includes(method) ? ['body: {}'] : []),
  ];

  return parts.length === 0 ? '' : `{ ${parts.join(', ')} }`;
}
