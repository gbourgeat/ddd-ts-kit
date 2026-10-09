import { CliError } from '../../errors.js';
import { toName, type Name } from '../../naming.js';
import { renderTemplate } from '../../templates.js';
import type { Kind } from '../kind.js';
import { label } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';

export const e2eKind: Kind = {
  name: 'e2e',
  aliases: [],
  usage: 'e2e <context> <UseCaseName>',
  summary: 'An end-to-end spec driving the route of a use case on the whole application, in test/e2e/ at the project root.',
  positionals: ['context', 'UseCaseName'],
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'handler'] });
    const endpoint = endpointOf(scope, name);
    const context = vars(scope, { name: named(name), e2e: endpoint });
    scope.ws.create(`test/e2e/${name.kebab}.e2e.spec.ts`, renderTemplate('e2e/e2e.spec.ts.tpl', context));
    if (!scope.ws.exists('test/e2e/support/application.ts')) {
      scope.ws.note('test/e2e/support/application.ts is missing: `ddd-ts-kit init` creates it (existing files are kept).');
    }
  },
};

/** What the route of the use case declares: an end-to-end spec drives the application through it. */
function endpointOf(scope: Scope, name: Name) {
  const file = `${scope.dir}/presentation/http/${name.kebab}.route.ts`;
  const route = scope.ws.read(file);
  const [, method, path] = /method: '([A-Z]+)',\s*path: '([^']+)'/.exec(route ?? '') ?? [];
  const status = /responses: \{ (\d{3}):/.exec(route ?? '')?.[1];
  if (method === undefined || path === undefined || status === undefined) {
    throw new CliError(
      `The use case ${name.pascal} has no route in "${scope.context.kebab}" (${file}).`,
      `An end-to-end spec drives the application through HTTP: create the route first with \`ddd-ts-kit generate route ${scope.context.kebab} ${name.pascal} --method <M> --path <path>\`.`,
    );
  }
  return {
    method,
    path,
    status: Number(status),
    call: method.toLowerCase(),
    hasBody: method === 'POST' || method === 'PUT' || method === 'PATCH',
    samplePath: path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, parameter: string) => `${toName(parameter).kebab}-1`),
  };
}
