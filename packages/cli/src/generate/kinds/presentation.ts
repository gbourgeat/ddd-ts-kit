import { CONFIG_FILE, isOneOf } from '../../config.js';
import { CliError } from '../../errors.js';
import { toName, type Name } from '../../naming.js';
import type { RenderContext } from '../../render.js';
import { emit, requireFile, wire, type Output } from '../emit.js';
import type { Kind, KindFlags } from '../kind.js';
import { label } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';

export const routeKind: Kind = {
  name: 'route',
  aliases: [],
  usage: 'route <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query]',
  summary: 'An HTTP route calling an existing use case through its bus, its spec and its registration.',
  positionals: ['context', 'UseCaseName'],
  run: (request) => {
    const scope = openScope(request);
    assertHttpStack(scope);
    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'handler'] });
    const endpoint = parseEndpoint(request.flags);
    const useCase = findUseCase(scope, name, request.flags);
    const context = vars(scope, { name: named(name), route: routeVars(scope, endpoint, useCase) });
    emit(scope, context, routeOutputs(scope, name, context));
    wire(scope, 'route', context);
  },
};

function assertHttpStack(scope: Scope): void {
  if (scope.config.stack.http !== 'none') return;
  throw new CliError(
    'This project has no HTTP stack (stack.http is "none").',
    `Set stack.http to express, fastify or nest in ${CONFIG_FILE} and add the matching platform files, or expose the use case another way.`,
  );
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ROUTE_PATH = /^\/$|^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))+$/;

interface Endpoint {
  readonly method: (typeof METHODS)[number];
  readonly path: string;
  readonly parameters: readonly string[];
}

function parseEndpoint(flags: KindFlags): Endpoint {
  const method = flags.method?.toUpperCase();
  if (!isOneOf(METHODS, method)) {
    throw new CliError(flags.method === undefined ? 'A route needs --method.' : `Unknown method "${flags.method}".`, `Pass --method with one of: ${METHODS.join(', ')}.`);
  }
  const { path } = flags;
  if (path === undefined || !ROUTE_PATH.test(path)) {
    throw new CliError(
      path === undefined ? 'A route needs --path.' : `"${path}" is not a valid route path.`,
      'Pass --path made of literal segments and ":name" parameters, for example /invoices/:invoiceId.',
    );
  }
  return { method, path, parameters: [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1] ?? '') };
}

interface UseCase {
  readonly isQuery: boolean;
  /** Class of the command or query, and its file inside the context, without extension. */
  readonly message: string;
  readonly messageFile: string;
  readonly returnsId: boolean;
}

function findUseCase(scope: Scope, name: Name, flags: KindFlags): UseCase {
  if (flags.command && flags.query) {
    throw new CliError('--command and --query exclude each other.', 'Keep the one matching the use case.');
  }
  const file = (kind: 'command' | 'query'): string => `application/${kind === 'query' ? 'queries' : 'commands'}/${name.kebab}/${name.kebab}.${kind}`;
  const has = (kind: 'command' | 'query'): boolean => scope.ws.exists(`${scope.dir}/${file(kind)}.ts`);
  const isQuery = flags.query || (!flags.command && !has('command') && has('query'));
  const kind = isQuery ? 'query' : 'command';
  requireFile(scope, {
    file: `${file(kind)}.ts`,
    what: `The ${kind} ${name.pascal}`,
    createdBy: `ddd-ts-kit generate ${kind} ${scope.context.kebab} ${name.pascal}`,
  });
  return {
    isQuery,
    message: `${name.pascal}${isQuery ? 'Query' : 'Command'}`,
    messageFile: file(kind),
    // A command that answers an identifier is declared `extends Command<string>`.
    returnsId: !isQuery && /extends\s+Command<\s*string\s*>/.test(scope.ws.read(`${scope.dir}/${file(kind)}.ts`) ?? ''),
  };
}

function routeVars(scope: Scope, endpoint: Endpoint, useCase: UseCase): RenderContext {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
  return {
    method: endpoint.method,
    path: endpoint.path,
    status: successStatus(endpoint, useCase),
    isQuery: useCase.isQuery,
    returnsId: useCase.returnsId,
    returnsNothing: !useCase.isQuery && !useCase.returnsId,
    hasBody,
    usesAnyObject: hasBody || useCase.isQuery,
    usesSchema: hasBody || useCase.isQuery || useCase.returnsId,
    ...requestVars(scope, endpoint, hasBody),
    ...busVars(useCase),
    ...parameterVars(endpoint.parameters),
    ...dtoVars(endpoint, useCase, hasBody),
  };
}

function requestVars(scope: Scope, { parameters }: Endpoint, hasBody: boolean) {
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
  if (useCase.isQuery) return 200;
  if (!useCase.returnsId) return 204;
  return endpoint.method === 'POST' ? 201 : 200;
}

function busVars(useCase: UseCase) {
  return {
    input: useCase.message,
    bus: useCase.isQuery ? 'queries' : 'commands',
    busToken: useCase.isQuery ? 'QUERY_BUS' : 'COMMAND_BUS',
    busType: useCase.isQuery ? 'QueryBus' : 'CommandBus',
    busClass: useCase.isQuery ? 'InMemoryQueryBus' : 'InMemoryCommandBus',
    useCaseImport: `import { ${useCase.message} } from '../../${useCase.messageFile}.js';`,
    messageImport: `import { ${useCase.message} } from '../../${useCase.messageFile}.js';`,
  };
}

function parameterVars(parameters: readonly string[]) {
  const sample = parameters.map((parameter) => `${parameter}: '${toName(parameter).kebab}-1'`).join(', ');
  return {
    zodParams: parameters.map((parameter) => `${parameter}: z.string().min(1)`).join(', '),
    dtoParams: parameters.map((parameter) => `  @IsString()\n  ${parameter} = '';`).join('\n\n'),
    sampleParams: parameters.length > 0 ? `{ ${sample} }` : '{}',
  };
}

function dtoVars(endpoint: Endpoint, useCase: UseCase, hasBody: boolean) {
  const base = useCase.message.replace(/(?:Command|Query)$/, '');
  const names = [
    ...(endpoint.parameters.length > 0 ? [`${base}Params`] : []),
    ...(hasBody ? [`${base}Body`] : []),
    ...(useCase.returnsId ? [`${base}Accepted`] : []),
    ...(useCase.isQuery ? [`${base}Answer`] : []),
  ];
  return { dtoNames: names.join(', '), hasDto: names.length > 0, dtoHasFields: endpoint.parameters.length > 0 || useCase.returnsId };
}

function routeOutputs(scope: Scope, name: Name, context: RenderContext): Output[] {
  const { validation } = scope.config.stack;
  const route = context['route'];
  const hasDto = typeof route === 'object' && route['hasDto'] === true;
  return [
    [`route/route.${validation}.ts.tpl`, `presentation/http/${name.kebab}.route.ts`],
    ...(validation === 'class-validator' && hasDto ? ([['route/dto.class-validator.ts.tpl', `presentation/http/${name.kebab}.dto.ts`]] as const) : []),
    ['route/route.spec.ts.tpl', `test/unit/${name.kebab}.route.spec.ts`],
  ];
}
