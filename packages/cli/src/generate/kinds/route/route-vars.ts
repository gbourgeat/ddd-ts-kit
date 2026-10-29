import { specifierOf } from '../../../alias';
import { toName, type Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { dtoClasses } from './dto-classes';
import { sharesSchemas } from './shares-schemas';
import { sampleParams } from './sample-params';
import type { MessagePlan } from './message-plan';
import { messageVars } from './message-vars';
import { planOf } from './plan-of';
import { writesBodyOf } from './writes-body-of';
import { writesParamsOf } from './writes-params-of';
import { specVars } from './spec-vars';
import { successStatus } from './success-status';
import type { Endpoint } from './endpoint';
import type { UseCase } from './use-case';

/** The validation libraries whose templates declare a schema for the path parameters. */
const TYPES_PARAMETERS: readonly string[] = ['zod', 'class-validator', 'typebox'];

export interface RouteParts {
  readonly name: Name;
  readonly endpoint: Endpoint;
  readonly useCase: UseCase;
}

/**
 * What the templates of a route read: its endpoint, the use case it calls, how the stack validates
 * and the fields of the message it reads, unless a request mapper builds the message.
 */
export function routeVars(scope: Scope, parts: RouteParts, reading = planOf(scope, parts, false)): RenderContext {
  const { name, endpoint, useCase } = parts;
  const status = successStatus(endpoint, useCase);
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
  const { config, context } = scope;
  const shared = sharesSchemas(config);
  const inContext = (file: string): string => specifierOf(config, `${config.contextsDir}/${context.kebab}/${file}`);

  return {
    method: endpoint.method,
    path: endpoint.path,
    status,
    isQuery: useCase.isQuery,
    isSearch: useCase.isSearch,
    returnsId: useCase.returnsId,
    ...acceptedVars(useCase, shared),
    returnsNothing: !useCase.isQuery && !useCase.returnsId,
    hasBody,
    ...schemaVars(scope, parts, reading),
    dtoImports: dtoClasses(endpoint, useCase, shared)
      .map(
        (role) =>
          `import { ${name.pascal}${toName(role).pascal} } from '${inContext(`presentation/http/${name.kebab}-${role}.dto.ts`)}';`,
      )
      .join('\n'),
    ...requestVars(scope, endpoint, reading),
    ...busVars(useCase, inContext(`${useCase.messageFile}.ts`)),
    ...securityVars(scope, useCase),
    ...parameterVars(endpoint.parameters),
    ...messageVars(scope, parts, reading),
    ...specVars({ name, endpoint, useCase, status }, reading),
  };
}

/** An identifier answer: a schema of the route, or the `Accepted` schema of the platform when schemas are shared. */
function acceptedVars(useCase: UseCase, shared: boolean): RenderContext {
  return {
    ownAccepted: useCase.returnsId && !shared,
    sharedAccepted: useCase.returnsId && shared,
    acceptedBody: shared ? 'acceptedSchema' : 'accepted',
  };
}

/** Whether the route declares schemas, and an object of any shape for the parts whose schema the generator leaves to the team. */
function schemaVars(scope: Scope, { endpoint, useCase }: RouteParts, reading: MessagePlan): RenderContext {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
  const shared = sharesSchemas(scope.config);

  return {
    usesAnyObject: (hasBody && !writesBodyOf(reading)) || useCase.isQuery,
    usesSchema:
      hasBody ||
      useCase.isQuery ||
      (useCase.returnsId && !shared) ||
      writesParamsOf(scope.config.stack.validation, reading),
  };
}

function requestVars(scope: Scope, { parameters, method }: Endpoint, reading: MessagePlan): RenderContext {
  const { validation } = scope.config.stack;
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  const typedParameters =
    (parameters.length > 0 && TYPES_PARAMETERS.includes(validation)) || writesParamsOf(validation, reading);

  return {
    hasParams: parameters.length > 0,
    hasRequest: typedParameters || hasBody,
    requestParts: [...(typedParameters ? ['params'] : []), ...(hasBody ? ['body'] : [])].join(', '),
  };
}

function busVars(useCase: UseCase, messageFile: string): RenderContext {
  const message = `import { ${useCase.message} } from '${messageFile}';`;

  return {
    input: useCase.message,
    bus: useCase.isQuery ? 'queries' : 'commands',
    busType: useCase.isQuery ? 'QueryBus' : 'CommandBus',
    useCaseImport: message,
    messageImport: message,
  };
}

/** A protected use case is reached with a credential; the bus decides, the route only says who is calling. */
function securityVars(scope: Scope, useCase: UseCase): RenderContext {
  const scheme = scope.config.stack.authn === 'none' ? 'developmentActor' : 'bearer';

  return {
    protected: useCase.isProtected,
    security: useCase.isProtected ? `['${scheme}']` : 'false',
    actor: useCase.isProtected ? 'actorOf(input.context.principal)' : '',
    errorCodes: useCase.isProtected ? "'UNAUTHORIZED', 'FORBIDDEN'" : '',
  };
}

function parameterVars(parameters: readonly string[]): RenderContext {
  return {
    zodParams: parameters.map((parameter) => `${parameter}: z.string().min(1)`).join(', '),
    typeboxParams: parameters.map((parameter) => `${parameter}: Type.String({ minLength: 1 })`).join(', '),
    dtoParams: parameters.map((parameter) => `@IsString()\n  ${parameter} = '';`).join('\n\n  '),
    sampleParams: sampleParams(parameters),
  };
}
