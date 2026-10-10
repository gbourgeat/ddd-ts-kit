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
import { routeVars, type RouteParts } from './route/route-vars.js';

export const routeKind: Kind = {
  name: 'route',
  aliases: [],
  usage: 'route <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query]',
  summary: 'An HTTP route calling an existing use case through its bus, its spec and its registration.',
  positionals: ['context', 'UseCaseName'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    assertHttpStack(scope);

    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'handler'] });
    const parts = { name, endpoint: parseEndpoint(request.flags), useCase: findUseCase(scope, name, request.flags) };
    const { validation } = scope.config.stack;

    const context = vars(scope, {
      name: named(name),
      route: routeVars(scope, parts),
      list: { customSchema: validation !== 'zod' && validation !== 'class-validator' },
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
    [`route/route.${useCase.isList ? 'list' : validation}.ts.tpl`, `presentation/http/${name.kebab}.route.ts`],
    ...dtos.map((role): Output => [`route/dto.${role}.ts.tpl`, `presentation/http/${name.kebab}-${role}.dto.ts`]),
    ['route/route.spec.ts.tpl', `test/unit/${name.kebab}.route.spec.ts`],
  ];
}
