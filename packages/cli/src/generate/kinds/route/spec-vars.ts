import { toName, type Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Endpoint } from './endpoint';
import type { FieldKind, MessagePlan, ReadField } from './message-plan';
import { sampleParams } from './sample-params';
import type { UseCase } from './use-case';
import { carriesBody } from './carries-body';
import { messageCall } from './message-call';

/** What a spec is written for: the route, the use case it calls and the status it answers when that succeeds. */
interface Specified {
  readonly name: Name;
  readonly endpoint: Endpoint;
  readonly useCase: UseCase;
  readonly status: number;
}

/** What a spec sends for a field of each type the route reads. */
const SAMPLES: Readonly<Record<FieldKind, (field: ReadField) => string>> = {
  string: (field) => `'${toName(field.name).kebab}-1'`,
  number: () => '1',
  boolean: () => 'true',
};

/**
 * What the spec of a route or a controller reads: one arrangement for all of them, a recording bus
 * that answers for the use case and `routeOf` of `@ddd-ts-kit/http/testing`, then the request sent,
 * a valid body when the route reads the fields of its message, the answer and the message handed to
 * the use case asserted. A route that reads its body is also sent that body without its first
 * field, and refuses it.
 */
export function specVars({ name, endpoint, useCase, status }: Specified, reading: MessagePlan): RenderContext {
  const bus = useCase.isQuery ? 'queries' : 'commands';
  const usesCaller = useCase.isProtected || useCase.isSearch;
  const caller = usesCaller ? ['caller'] : [];
  const body = bodyOf(reading);

  return {
    recordingBus: useCase.isQuery ? 'RecordingQueryBus' : 'RecordingCommandBus',
    recordingAnswer: answerOf(name, useCase),
    sentParts: ['route', ...caller, 'send'].join(', '),
    sentPartsOfRoute: [...caller, 'send'].join(', '),
    sentRequest: sentRequestOf(endpoint, body),
    ...refusalVars(endpoint, body),
    answerExpectation: useCase.returnsId
      ? `expect(response).toMatchObject({ status: ${status}, body: { id: '${name.kebab}-1' } });`
      : `expect(response.status).toBe(${status});`,
    messageExpectation: useCase.isSearch
      ? `expect(${bus}.executed).toMatchObject([{ actor: caller }]);`
      : `expect(${bus}.executed).toEqual([${messageCall(useCase, reading, { actor: 'caller', field: sampleOf })}]);`,
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

function bodyOf(reading: MessagePlan): ReadField[] {
  return reading.read.filter((field) => field.from === 'body');
}

/**
 * The body without the first field it reads: no initial value stands in for the missing field,
 * whatever the library, so the route answers 422 with that field named and calls nothing.
 */
function refusalVars(endpoint: Endpoint, body: readonly ReadField[]): RenderContext {
  const [missing, ...rest] = body;

  if (missing === undefined) {
    return { refusesMissing: false };
  }

  return {
    refusesMissing: true,
    missingField: missing.name,
    missingRequest: sentRequestOf(endpoint, rest),
  };
}

/** The request the spec sends: a sample of each path parameter, and to a route that reads a body, a sample of each field it reads there. */
function sentRequestOf({ method, parameters }: Endpoint, body: readonly ReadField[]): string {
  const sent = body.map((field) => `${field.name}: ${sampleOf(field)}`);

  const parts = [
    ...(parameters.length > 0 ? [`params: ${sampleParams(parameters)}`] : []),
    ...(carriesBody(method) ? [sent.length === 0 ? 'body: {}' : `body: { ${sent.join(', ')} }`] : []),
  ];

  return parts.length === 0 ? '' : `{ ${parts.join(', ')} }`;
}

/** A path parameter is sent as the spec names it, `invoice-id-1`, and so is a string of the body. */
function sampleOf(field: ReadField): string {
  return SAMPLES[field.kind](field);
}
