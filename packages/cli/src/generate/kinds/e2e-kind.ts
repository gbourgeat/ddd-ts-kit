import { CliError } from '../../cli-error.js';
import { fitStatement } from '../../layout/index.js';
import { toName, type Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { renderTemplate } from '../../templating/index.js';
import type { Kind } from '../kind.js';
import { label } from '../label.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { tracedCommand } from './traced-command.js';

export const e2eKind: Kind = {
  name: 'e2e',
  aliases: [],
  usage: 'e2e <context> <UseCaseName>',
  summary:
    'An end-to-end spec driving the route of a use case on the whole application, in test/e2e/ at the project root.',
  positionals: ['context', 'UseCaseName'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'handler'] });

    const endpoint = endpointOf(scope, name);
    const traced = tracedCommand(scope, name);
    const command = `{ name: 'command ${name.pascal}Command'${traced.saved} }`;
    const tree = spanTree(`${endpoint.method} ${endpoint.path}`, command);
    const context = vars(scope, { name: named(name), e2e: { ...endpoint, ...traced, tree } });

    scope.ws.create(`test/e2e/${name.kebab}.e2e.spec.ts`, renderTemplate('e2e/e2e.spec.ts.tpl', context));

    if (!scope.ws.exists('test/e2e/support/start-application.ts')) {
      scope.ws.note(
        'test/e2e/support/start-application.ts is missing: `ddd-ts-kit init` creates it (existing files are kept).',
      );
    }
  },
};

/** The spans a request leaves, as the spec expects them, laid out for the six spaces the element is written after. */
function spanTree(request: string, command: string): string {
  const element = `{ name: '${request}', kind: 'SERVER', children: [${command}] },`;

  return fitStatement(element, '      ').join('\n').trimStart();
}

/** What the route of the use case declares: an end-to-end spec drives the application through it. */
function endpointOf(scope: Scope, name: Name): RenderContext & { readonly method: string; readonly path: string } {
  const file = `${scope.dir}/presentation/http/${name.kebab}.route.ts`;
  const route = scope.ws.read(file) ?? '';
  const [, method, path] = /method: '([A-Z]+)',\s*path: '([^']+)'/.exec(route) ?? [];
  const status = /responses: \{ (\d{3}):/.exec(route)?.[1];

  if (method === undefined || path === undefined || status === undefined) {
    throw noRoute(scope, name, file);
  }

  return {
    method,
    path,
    status: Number(status),
    call: method.toLowerCase(),
    body: ['POST', 'PUT', 'PATCH'].includes(method) ? ', {}' : '',
    protected: !/security:\s*false/.test(route),
    samplePath: path.replace(
      /:([A-Za-z_][A-Za-z0-9_]*)/g,
      (_match, parameter: string) => `${toName(parameter).kebab}-1`,
    ),
  };
}

function noRoute(scope: Scope, name: Name, file: string): CliError {
  return new CliError(
    `The use case ${name.pascal} has no route in "${scope.context.kebab}" (${file}).`,
    `An end-to-end spec drives the application through HTTP: create the route first with \`ddd-ts-kit generate route ${scope.context.kebab} ${name.pascal} --method <M> --path <path>\`.`,
  );
}
