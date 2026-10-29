import { readControllers } from '../../describe/read-controllers';
import { fitStatement } from '../../layout';
import { toName, type Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { renderTemplate } from '../../templating';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { reactionOf, type JobStart, type Reaction } from './e2e/reaction-of';
import { tracedCommand } from './traced-command';
import { declaredModules } from '../../model-modules';

export const e2eKind: Kind = {
  name: 'e2e',
  aliases: [],
  usage: 'e2e <context> <UseCaseName> [--event <eventType>]',
  summary:
    'An end-to-end spec on the whole application, in test/e2e/ at the project root: driving the route of a use case, or, for a use case no route reaches, publishing the integration event its handler receives (--event names it when several do) or running the job that sends its command.',
  positionals: ['context', 'UseCaseName'],
  writesShared: false,
  writesInModules: false,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['route', 'controller', 'handler'] });
    const file = `${scope.dir}/presentation/http/${name.kebab}.route.ts`;
    const endpoint = scope.flags.event === undefined ? endpointOf(scope, name, file) : undefined;
    const spec = `test/e2e/${name.kebab}.e2e.spec.ts`;

    let starts: Starter = 'route';

    if (endpoint === undefined) {
      const reaction = reactionOf(scope, name, file);

      starts = 'jobs' in reaction ? 'job' : 'event';

      scope.ws.create(spec, reactionSpec(scope, name, reaction));
    } else {
      const traced = tracedCommand(scope, name);
      const command = `{ name: 'command ${name.pascal}Command'${traced.saved} }`;
      const tree = spanTree(`${endpoint.method} ${endpoint.path}`, command);

      scope.ws.create(
        spec,
        renderTemplate(
          'e2e/e2e.spec.ts.tpl',
          vars(scope, { name: named(name), e2e: { ...endpoint, ...traced, tree } }),
        ),
      );
    }

    noteSupport(scope, starts);
  },
};

/** The spec of a use case no route reaches: it publishes the event its handler receives, or runs the job that sends its command. */
function reactionSpec(scope: Scope, name: Name, reaction: Reaction | JobStart): string {
  if (!('jobs' in reaction)) {
    return renderTemplate('e2e/e2e-reaction.spec.ts.tpl', vars(scope, { name: named(name), ...reaction }));
  }

  const cases = reaction.jobs
    .map((job) =>
      renderTemplate('e2e/e2e-job-case.ts.tpl', vars(scope, { name: named(name), job: { name: job } })).trimEnd(),
    )
    .join('\n\n');

  return renderTemplate('e2e/e2e-job.spec.ts.tpl', vars(scope, { name: named(name), e2e: { ...reaction.e2e, cases } }));
}

/** What starts the use case the spec drives. */
type Starter = 'route' | 'event' | 'job';

const SUPPORT = 'test/e2e/support/start-application.ts';

/** What the spec needs of the support of the project: `init` writes it, older projects add `publish` by hand. */
function noteSupport(scope: Scope, starts: Starter): void {
  const support = scope.ws.read(SUPPORT);

  if (support === undefined) {
    scope.ws.note(`${SUPPORT} is missing: \`ddd-ts-kit init\` creates it (existing files are kept).`);
  } else if (starts === 'job' && !/^\s*runJob\(/m.test(support)) {
    scope.ws.note(
      `${SUPPORT} has no runJob(name): add \`runJob(name: string): Promise<void>;\` to RunningApplication and implement it with \`async (name) => { await application.jobs.runNow(name); }\` on the composed application (\`jobs\` is its JobScheduler: \`platform.jobs\` by hand, \`container.resolve(JobScheduler)\` on tsyringe), as a new project has it.`,
    );
  } else if (starts === 'event' && !/^\s*publish\(/m.test(support)) {
    scope.ws.note(
      `${SUPPORT} has no publish(events): add \`publish(events: readonly IntegrationEvent[]): Promise<void>;\` to RunningApplication and implement it with \`(events) => application.eventBus.publish(events)\` on the composed application, as a new project has it.`,
    );
  }
}

/** The spans a request leaves, as the spec expects them, laid out for the six spaces the element is written after. */
function spanTree(request: string, command: string): string {
  const element = `{ name: '${request}', kind: 'SERVER', children: [${command}] },`;

  return fitStatement(element, '      ').join('\n').trimStart();
}

interface Declared {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly isProtected: boolean;
}

/** What the route of the use case declares, when it has one: an end-to-end spec drives the application through it. */
function endpointOf(
  scope: Scope,
  name: Name,
  file: string,
): (RenderContext & { readonly method: string; readonly path: string }) | undefined {
  const route = functionRoute(scope.ws.read(file) ?? '');

  if (route !== undefined) {
    scope.flags.builtOn?.(scope.ws.placed(file));
  }

  const { method, path, status, isProtected } = route ?? controllerOf(scope, name) ?? {};

  if (method === undefined || path === undefined || status === undefined) {
    return undefined;
  }

  return {
    method,
    path,
    status,
    call: method.toLowerCase(),
    body: ['POST', 'PUT', 'PATCH'].includes(method) ? ', {}' : '',
    protected: isProtected === true,
    samplePath: path.replace(
      /:([A-Za-z_][A-Za-z0-9_]*)/g,
      (_match, parameter: string) => `${toName(parameter).kebab}-1`,
    ),
  };
}

function functionRoute(route: string): Declared | undefined {
  const [, method, path] = /method: '([A-Z]+)',\s*path: '([^']+)'/.exec(route) ?? [];
  const status = /responses: \{ (\d{3}):/.exec(route)?.[1];

  if (method === undefined || path === undefined || status === undefined) {
    return undefined;
  }

  return { method, path, status: Number(status), isProtected: !/security:\s*false/.test(route) };
}

/** The controller of the use case, wherever its folder is, read with the prefix and the guards of its groups. */
function controllerOf(scope: Scope, name: Name): Declared | undefined {
  const { ws, config, context, dir } = scope;

  const sources = {
    ws,
    config,
    name: context.kebab,
    directory: dir,
    modules: declaredModules(config, context.kebab),
    module: '',
  };

  const route = readControllers(sources, []).find(({ file }) => file.endsWith(`/${name.kebab}.controller.ts`));
  const [response] = route?.responses ?? [];

  if (route === undefined || response === undefined) {
    return undefined;
  }

  scope.flags.builtOn?.(route.file);

  return {
    method: route.method,
    path: route.path,
    status: response.status,
    isProtected: !route.guards.includes('Public'),
  };
}
