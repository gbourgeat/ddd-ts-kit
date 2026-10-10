import { toName, type Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';
import type { Scope } from '../../scope.js';
import { dtoClasses } from './dto-classes.js';
import type { Endpoint } from './endpoint.js';
import type { UseCase } from './use-case.js';

export interface RouteParts {
  readonly name: Name;
  readonly endpoint: Endpoint;
  readonly useCase: UseCase;
}

/** What the templates of a route read: its endpoint, the use case it calls and how the stack validates. */
export function routeVars(scope: Scope, { name, endpoint, useCase }: RouteParts): RenderContext {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

  return {
    method: endpoint.method,
    path: endpoint.path,
    status: successStatus(endpoint, useCase),
    isQuery: useCase.isQuery,
    isPlainQuery: useCase.isQuery && !useCase.isList,
    isList: useCase.isList,
    returnsId: useCase.returnsId,
    returnsNothing: !useCase.isQuery && !useCase.returnsId,
    hasBody,
    usesAnyObject: hasBody || useCase.isQuery,
    usesSchema: hasBody || useCase.isQuery || useCase.returnsId,
    dtoImports: dtoClasses(endpoint, useCase)
      .map((role) => `import { ${name.pascal}${toName(role).pascal} } from './${name.kebab}-${role}.dto.js';`)
      .join('\n'),
    ...requestVars(scope, endpoint, hasBody),
    ...busVars(useCase),
    ...securityVars(scope, useCase),
    ...parameterVars(endpoint.parameters),
  };
}

function requestVars(scope: Scope, { parameters }: Endpoint, hasBody: boolean): RenderContext {
  const { validation } = scope.config.stack;
  // Only the zod and class-validator variants declare a schema for path parameters.
  const typedParameters = parameters.length > 0 && (validation === 'zod' || validation === 'class-validator');

  return {
    hasParams: parameters.length > 0,
    hasRequest: typedParameters || hasBody,
    requestParts: [...(typedParameters ? ['params'] : []), ...(hasBody ? ['body'] : [])].join(', '),
  };
}

function successStatus(endpoint: Endpoint, useCase: UseCase): number {
  if (useCase.isQuery) {
    return 200;
  }

  if (!useCase.returnsId) {
    return 204;
  }

  return endpoint.method === 'POST' ? 201 : 200;
}

function busVars(useCase: UseCase): RenderContext {
  return {
    input: useCase.message,
    bus: useCase.isQuery ? 'queries' : 'commands',
    busType: useCase.isQuery ? 'QueryBus' : 'CommandBus',
    busClass: useCase.isQuery ? 'InMemoryQueryBus' : 'InMemoryCommandBus',
    useCaseImport: `import { ${useCase.message} } from '../../${useCase.messageFile}.js';`,
    messageImport: `import { ${useCase.message} } from '../../${useCase.messageFile}.js';`,
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
  const sample = parameters.map((parameter) => `${parameter}: '${toName(parameter).kebab}-1'`).join(', ');

  return {
    zodParams: parameters.map((parameter) => `${parameter}: z.string().min(1)`).join(', '),
    dtoParams: parameters.map((parameter) => `@IsString()\n  ${parameter} = '';`).join('\n\n  '),
    sampleParams: parameters.length > 0 ? `{ ${sample} }` : '{}',
  };
}
