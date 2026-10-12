import { CONFIG_FILE } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import { emit, type Output } from '../emit.js';
import type { Kind } from '../kind.js';
import { label } from '../label.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import { dtoClasses } from './route/dto-classes.js';
import { findUseCase } from './route/find-use-case.js';
import { parseEndpoint } from './route/parse-endpoint.js';
import { planController } from './route/plan-controller.js';
import { routeVars, type RouteParts } from './route/route-vars.js';
import { writeController } from './route/write-controller.js';

const USAGE =
  '<context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer]';

export const routeKind: Kind = {
  name: 'route',
  aliases: [],
  usage: `route ${USAGE}`,
  summary:
    'An HTTP route calling an existing use case through its bus, with its spec: under "stack.routes": "controllers", a controller class in its folder, behind the guards of its route group; under "functions", a defineRoute function and its registration.',
  positionals: ['context', 'UseCaseName'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    assertHttpStack(scope);

    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'controller', 'handler'] });
    const parts = { name, endpoint: parseEndpoint(request.flags), useCase: findUseCase(scope, name, request.flags) };
    const { validation, routes } = scope.config.stack;

    if (routes === 'controllers' || request.asController === true) {
      writeController(scope, planController(scope, parts));

      return;
    }

    const context = vars(scope, {
      name: named(name),
      route: routeVars(scope, parts),
      search: { customSchema: validation !== 'zod' && validation !== 'class-validator' },
    });

    emit(scope, context, routeOutputs(scope, parts));
    wire(scope, 'route', context);
  },
};

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
  const dtos = validation === 'class-validator' ? dtoClasses(endpoint, useCase) : [];

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
