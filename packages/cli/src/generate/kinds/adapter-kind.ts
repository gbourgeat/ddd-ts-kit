import { CliError } from '../../cli-error.js';
import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { emit } from '../emit.js';
import { filesUnder } from '../files-under.js';
import { isDeclared } from '../is-declared.js';
import type { Kind } from '../kind.js';
import { label } from '../label.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { requireFile } from '../require-file.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import { writeOwnPolicy } from './write-own-policy.js';

const ADAPTER_KINDS = ['external', 'gateway'];

export const adapterKind: Kind = {
  name: 'adapter',
  aliases: [],
  usage: 'adapter <context> <Port> [--kind external|gateway] [--decorators]',
  summary:
    'An infrastructure adapter of an existing port towards an outside system, its spec and its registration with a retry and timeout policy; with --decorators its outbound method carries the policy itself.',
  positionals: ['context', 'Port'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });

    requireFile(scope, {
      file: `application/ports/${name.kebab}.port.ts`,
      what: `The port ${name.pascal}`,
      createdBy: `ddd-ts-kit generate port ${scope.context.kebab} ${name.pascal}`,
    });

    const adapter = adapterVars(scope, name);

    refuseSecondAdapter(scope, name);

    const context = vars(scope, { name: named(name), adapter });

    emit(scope, context, [
      ['adapter/adapter.ts.tpl', `infrastructure/external/${adapter.file}.ts`],
      ['adapter/adapter.spec.ts.tpl', `test/integration/remote-${name.kebab}.adapter.spec.ts`],
    ]);

    register(scope, context, { port: name.pascal, kind: adapter.kind, decorated: adapter.decorated });
  },
};

interface AdapterVars {
  readonly [key: string]: string | boolean;
  readonly kind: string;
  readonly decorated: boolean;
  readonly file: string;
}

/**
 * How the adapter is bound. Declared, the class says it: `@Gateway` in a `*.gateway.ts` file for
 * a call to another context, `@Adapter` with its kind in a `*.adapter.ts` file for anything else.
 */
function adapterVars(scope: Scope, name: Name): AdapterVars {
  const kind = bindingKind(scope);
  const towardsContext = kind === 'gateway' && isDeclared(scope.config);

  return {
    kind,
    decorated: scope.flags.decorators,
    file: `remote-${name.kebab}.${towardsContext ? 'gateway' : 'adapter'}`,
    decorator: towardsContext ? 'Gateway' : 'Adapter',
    hasKind: !towardsContext,
    kindOption: towardsContext ? '' : `kind: '${kind}', `,
  };
}

function bindingKind(scope: Scope): string {
  const kind = scope.flags.kind ?? 'external';

  if (ADAPTER_KINDS.includes(kind)) {
    return kind;
  }

  throw new CliError(
    `Unknown value "${kind}" for --kind.`,
    `Use one of: ${ADAPTER_KINDS.join(', ')} (external: a system outside the application; gateway: another bounded context).`,
  );
}

/**
 * A port has one adapter: a second class declaring itself for it would stop the application at
 * startup, and a second class the module file cannot bind would be wired by nothing
 * (`declarations/port-adapter-wired`).
 */
function refuseSecondAdapter(scope: Scope, name: Name): void {
  const bound = isDeclared(scope.config) ? declaredAdapterOf(scope, name.pascal) : boundIn(scope, name.pascal);

  if (bound === undefined) {
    return;
  }

  throw new CliError(
    `${name.pascal} is already bound by ${bound}.`,
    `A port has one adapter. When the outside system is ready, turn that class into the remote adapter (its ${isDeclared(scope.config) ? 'declaration' : 'binding'} stays), or remove it and run the command again.`,
  );
}

function declaredAdapterOf(scope: Scope, port: string): string | undefined {
  const declaration = new RegExp(`@(?:Repository|Gateway|Adapter)\\(\\s*${port}\\b`);

  const bound = filesUnder(scope.ws, `${scope.dir}/infrastructure`).find((file) =>
    declaration.test(scope.ws.read(`${scope.dir}/infrastructure/${file}`) ?? ''),
  );

  return bound === undefined ? undefined : `infrastructure/${bound}`;
}

/** The module file, when it already binds the port. */
function boundIn(scope: Scope, port: string): string | undefined {
  const module = `${scope.context.kebab}.module.ts`;

  return new RegExp(`\\bbind\\(${port}\\)`).test(scope.ws.read(`${scope.dir}/${module}`) ?? '') ? module : undefined;
}

interface Registration {
  readonly port: string;
  readonly kind: string;
  readonly decorated: boolean;
}

/**
 * A declared adapter binds itself. Otherwise it is bound by the generator where the module
 * declares its bindings, and said in a note where the wiring is by hand. The first adapter that
 * names `ownPolicy` brings the helper to the platform.
 */
function register(scope: Scope, context: RenderContext, { port, kind, decorated }: Registration): void {
  const module = `${scope.context.kebab}.module.ts`;
  const about = `{ kind: '${kind}', context: '${scope.context.kebab}' }`;

  if (isDeclared(scope.config)) {
    writeOwnPolicy(scope, context);

    return;
  }

  if (scope.config.stack.di === 'tsyringe') {
    wire(scope, 'adapter', context);
    writeOwnPolicy(scope, context);
  } else {
    const wrapped = decorated
      ? `platform.selfGoverned(new Remote${port}(), ${about})`
      : `platform.adapter(ownPolicy(retry({ attempts: 3 }), timeout(2000))(new Remote${port}(), ${about}), ${about})`;

    scope.ws.note(`Instantiate Remote${port} in ${module} and give it to the handlers that need it: ${wrapped}.`);
  }
}
