import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import { emit, type Output } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { searchedElements } from '../searched-elements';
import { vars } from '../vars';
import { wire } from '../wire';
import { dtoClasses } from './route/dto-classes';
import { sharesSchemas } from './route/shares-schemas';
import { findUseCase } from './route/find-use-case';
import { parseEndpoint } from './route/parse-endpoint';
import { planController } from './route/plan-controller';
import { routeVars, type RouteParts } from './route/route-vars';
import { writeController } from './route/write-controller';
import { writeNestController } from './route/write-nest-controller';
import { SEARCH_LINE_LIBRARIES } from './route/search-line-libraries';

const USAGE =
  '<context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store]';

export const routeKind: Kind = {
  name: 'route',
  aliases: [],
  usage: `route ${USAGE}`,
  summary:
    'An HTTP route calling an existing use case through its bus, with its spec: under "stack.routes": "controllers", a controller class in its folder, behind the guards of its route group; under "functions", a defineRoute function and its registration; under "nest", a Nest controller whose method carries @KitRoute, listed in the module of its context.',
  positionals: ['context', 'UseCaseName'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    assertHttpStack(scope);

    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'controller', 'handler'] });
    const parts = { name, endpoint: parseEndpoint(request.flags), useCase: findUseCase(scope, name, request.flags) };
    const { validation, routes } = scope.config.stack;

    if (routes === 'nest' && request.asController !== true) {
      writeNestController(scope, planController(scope, parts));

      return;
    }

    if (routes === 'controllers' || request.asController === true) {
      writeController(scope, planController(scope, parts));

      return;
    }

    assertNoCachePolicy(scope);

    const context = vars(scope, {
      name: named(name),
      route: routeVars(scope, parts),
      search: { customSchema: !SEARCH_LINE_LIBRARIES.has(validation), ...searchedElements(name) },
    });

    emit(scope, context, routeOutputs(scope, parts));
    wire(scope, 'route', context);
  },
};

function assertNoCachePolicy(scope: Scope): void {
  if (scope.flags.cache === undefined) {
    return;
  }

  throw new CliError(
    '--cache writes the cache policy of a controller, and this project writes its routes as functions.',
    'Write `cache` in the spec of the route, or generate it as a controller: `ddd-ts-kit generate controller ...`.',
  );
}

function assertHttpStack(scope: Scope): void {
  if (scope.config.stack.http !== 'none') {
    return;
  }

  throw new CliError(
    'This project has no HTTP stack (stack.http is "none").',
    `Set stack.http to express, fastify or nest in ${CONFIG_FILE} and add the matching platform files, or expose the use case another way.`,
  );
}

function routeOutputs(scope: Scope, { name, endpoint, useCase }: RouteParts): Output[] {
  const { validation } = scope.config.stack;
  const dtos = validation === 'class-validator' ? dtoClasses(endpoint, useCase, sharesSchemas(scope.config)) : [];

  return [
    [`route/route.${useCase.isSearch ? 'search' : validation}.ts.tpl`, `presentation/http/${name.kebab}.route.ts`],
    ...dtos.map((role): Output => [`route/dto.${role}.ts.tpl`, `presentation/http/${name.kebab}-${role}.dto.ts`]),
    ['route/route.spec.ts.tpl', `test/unit/${name.kebab}.route.spec.ts`],
  ];
}

/** The same as `route`, always as a controller class: for a project of function routes that moves one route at a time. */
export const controllerKind: Kind = {
  ...routeKind,
  name: 'controller',
  usage: `controller ${USAGE}`,
  summary:
    'A controller class calling an existing use case through its bus, whatever "stack.routes" says: its folder, its schemas, its spec, and its route group when it is new.',
  run: (request) => routeKind.run({ ...request, asController: true }),
};
