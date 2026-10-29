import { specifierOf } from '../../../alias';
import { toName, type Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { dtoClasses } from './dto-classes';
import { sharesSchemas } from './shares-schemas';
import { sampleParams } from './sample-params';
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

/** What the templates of a route read: its endpoint, the use case it calls and how the stack validates. */
export function routeVars(scope: Scope, { name, endpoint, useCase }: RouteParts): RenderContext {
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
    usesAnyObject: hasBody || useCase.isQuery,
    usesSchema: hasBody || useCase.isQuery || (useCase.returnsId && !shared),
    dtoImports: dtoClasses(endpoint, useCase, shared)
      .map(
        (role) =>
          `import { ${name.pascal}${toName(role).pascal} } from '${inContext(`presentation/http/${name.kebab}-${role}.dto.ts`)}';`,
      )
      .join('\n'),
    ...requestVars(scope, endpoint, hasBody),
    ...busVars(useCase, inContext(`${useCase.messageFile}.ts`)),
    ...securityVars(scope, useCase),
    ...parameterVars(endpoint.parameters),
    ...specVars({ name, endpoint, useCase, status }),
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

function requestVars(scope: Scope, { parameters }: Endpoint, hasBody: boolean): RenderContext {
  const { validation } = scope.config.stack;
  const typedParameters = parameters.length > 0 && TYPES_PARAMETERS.includes(validation);

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
