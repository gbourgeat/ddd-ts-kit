import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { emit } from '../emit';
import { filesUnder } from '../files-under';
import { declaredModules, intoModule, roleFoldersOf, treeOf } from '../../model-modules';
import { toName } from '../../naming';
import { isDeclared } from '../is-declared';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import { requireFile } from '../require-file';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { writeOwnPolicy } from './write-own-policy';

const ADAPTER_KINDS = ['external', 'gateway'];

export const adapterKind: Kind = {
  name: 'adapter',
  aliases: [],
  usage: 'adapter <context> <Port> [--kind external|gateway] [--decorators]',
  summary:
    'An infrastructure adapter of an existing port towards an outside system, its spec and its registration with a retry and timeout policy; with --decorators its outbound method carries the policy itself.',
  positionals: ['context', 'Port'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });

    requireFile(scope, {
      file: `application/ports/${name.kebab}.port.ts`,
      what: `The port ${name.pascal}`,
      createdBy: `ddd-ts-kit generate port ${scope.context.kebab} ${name.pascal}`,
    });

    placeWithItsPort(scope, { name, asked: request.flags.module });

    const adapter = adapterVars(scope, name);

    if (isDeclared(scope.config)) {
      refuseSecondAdapter(scope, name);
    }

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

/** What the adapter of a port is written next to: the port it implements, and the module `--module` names. */
interface PortOfAdapter {
  readonly name: Name;
  readonly asked: string | undefined;
}

/**
 * In a context divided into modules, the adapter of a port sits in the module of its port: a
 * `--module` naming another one is refused, and so is a missing `--module`, with the command that
 * names the right one.
 */
function placeWithItsPort(scope: Scope, { name, asked }: PortOfAdapter): void {
  const port = `application/ports/${name.kebab}.port.ts`;
  const modules = declaredModules(scope.config, scope.context.kebab);
  const holder = modules.find((module) => scope.ws.existsAsIs(`${scope.dir}/${intoModule(module, port)}`));

  if (holder === undefined || toName(asked ?? '').kebab === holder) {
    return;
  }

  throw new CliError(
    `The port ${name.pascal} of "${scope.context.kebab}" is in the module "${holder}": its adapter goes with it${asked === undefined ? '' : `, not in "${asked}"`}.`,
    `Run it with the module of the port: \`ddd-ts-kit generate adapter ${scope.context.kebab} ${name.pascal} --module ${holder}\`.`,
  );
}

/** A port has one adapter: a second class declaring itself for it would stop the application at startup. */
function refuseSecondAdapter(scope: Scope, name: Name): void {
  const declaration = new RegExp(`@(?:Repository|Gateway|Adapter)\\(\\s*${name.pascal}\\b`);

  // The infrastructure of the context and that of each module of its model.
  const bound = roleFoldersOf(scope.ws, treeOf(scope.config, scope.context.kebab), 'infrastructure')
    .flatMap((folder) => filesUnder(scope.ws, folder).map((file) => `${folder}/${file}`))
    .find((file) => declaration.test(scope.ws.read(file) ?? ''));

  if (bound === undefined) {
    return;
  }

  throw new CliError(
    `${name.pascal} is already bound by ${bound.slice(scope.dir.length + 1)}.`,
    `A port has one adapter. When the outside system is ready, turn that class into the remote adapter (its declaration stays), or remove it and run the command again.`,
  );
}

interface Registration {
  readonly port: string;
  readonly kind: string;
  readonly decorated: boolean;
}

/**
 * A declared adapter binds itself. Otherwise it is bound by the generator where the module
 * declares its bindings, and said in a note where the wiring is by hand or the port already has
 * an adapter. The first adapter that names `ownPolicy` brings the helper to the platform.
 */
function register(scope: Scope, context: RenderContext, { port, kind, decorated }: Registration): void {
  const module = `${scope.context.kebab}.module.ts`;
  const about = `{ kind: '${kind}', context: '${scope.context.kebab}' }`;

  if (isDeclared(scope.config)) {
    writeOwnPolicy(scope, context);

    return;
  }

  if (isBound(scope, port)) {
    scope.ws.note(
      `${port} is already bound in ${module}: bind Remote${port} in its place when the outside system is ready, with .as('${kind}').`,
    );
  } else if (scope.config.stack.di === 'tsyringe') {
    wire(scope, 'adapter', context);
    writeOwnPolicy(scope, context);
  } else {
    const wrapped = decorated
      ? `platform.selfGoverned(new Remote${port}(), ${about})`
      : `platform.adapter(ownPolicy(retry({ attempts: 3 }), timeout(2000))(new Remote${port}(), ${about}), ${about})`;

    scope.ws.note(`Instantiate Remote${port} in ${module} and give it to the handlers that need it: ${wrapped}.`);
  }
}

function isBound(scope: Scope, port: string): boolean {
  const module = scope.ws.read(`${scope.dir}/${scope.context.kebab}.module.ts`) ?? '';

  return new RegExp(`\\bbind\\(${port}\\)`).test(module);
}
