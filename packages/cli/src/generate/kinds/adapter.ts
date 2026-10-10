import { CliError } from '../../errors.js';
import type { RenderContext } from '../../render.js';
import type { Name } from '../../naming.js';
import { filesUnder, isDeclared } from '../declared.js';
import { emit, requireFile, wire } from '../emit.js';
import type { Kind } from '../kind.js';
import { label } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';

const ADAPTER_KINDS = ['external', 'gateway'];

export const adapterKind: Kind = {
  name: 'adapter',
  aliases: [],
  usage: 'adapter <context> <Port> [--kind external|gateway] [--decorators]',
  summary: 'An infrastructure adapter of an existing port towards an outside system, its spec and its registration with a retry and timeout policy; with --decorators its outbound method carries the policy itself.',
  positionals: ['context', 'Port'],
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });
    requireFile(scope, { file: `application/ports/${name.kebab}.port.ts`, what: `The port ${name.pascal}`, createdBy: `ddd-ts-kit generate port ${scope.context.kebab} ${name.pascal}` });
    const adapter = adapterVars(scope, name);
    if (isDeclared(scope.config)) refuseSecondAdapter(scope, name);
    const context = vars(scope, { name: named(name), adapter });
    emit(scope, context, [
      ['adapter/adapter.ts.tpl', `infrastructure/external/${adapter.file}.ts`],
      ['adapter/adapter.spec.ts.tpl', `test/integration/remote-${name.kebab}.adapter.spec.ts`],
    ]);
    register(scope, context, { port: name.pascal, kind: adapter.kind, decorated: adapter.decorated });
  },
};

/**
 * How the adapter is bound. Declared, the class says it: `@Gateway` in a `*.gateway.ts` file for
 * a call to another context, `@Adapter` with its kind in a `*.adapter.ts` file for anything else.
 */
function adapterVars(scope: Scope, name: Name) {
  const kind = bindingKind(scope);
  const towardsContext = kind === 'gateway' && isDeclared(scope.config);
  return {
    kind,
    decorated: scope.flags.decorators,
    file: `remote-${name.kebab}.${towardsContext ? 'gateway' : 'adapter'}`,
    decorator: towardsContext ? 'Gateway' : 'Adapter',
    kindOption: towardsContext ? '' : `kind: '${kind}', `,
  };
}

/** A token has one adapter: a second class declaring itself for it would stop the application at startup. */
function refuseSecondAdapter(scope: Scope, name: Name): void {
  const declaration = new RegExp(`@(?:Repository|Gateway|Adapter)\\(\\s*${name.constant}\\b`);
  const bound = filesUnder(scope.ws, `${scope.dir}/infrastructure`, '').find((file) => declaration.test(scope.ws.read(`${scope.dir}/infrastructure/${file}`) ?? ''));
  if (bound === undefined) return;
  throw new CliError(
    `${name.pascal} is already bound by infrastructure/${bound}.`,
    `A token has one adapter. When the outside system is ready, turn that class into the remote adapter (its declaration stays), or remove it and run the command again.`,
  );
}

interface Registration {
  readonly port: string;
  readonly kind: string;
  readonly decorated: boolean;
}

/**
 * A declared adapter binds itself: only its token is written. Otherwise it is bound by the
 * generator where the module declares its bindings, and said in a note where the wiring is by
 * hand or the port already has an adapter.
 */
function register(scope: Scope, context: RenderContext, { port, kind, decorated: isDecorated }: Registration): void {
  const module = `${scope.context.kebab}.module.ts`;
  if (isDeclared(scope.config)) {
    wire(scope, 'adapter', context);
  } else if (isBound(scope, port)) {
    scope.ws.note(`${port} is already bound in ${module}: bind Remote${port} in its place when the outside system is ready, with .as('${kind}').`);
  } else if (scope.config.stack.di === 'tsyringe') {
    wire(scope, 'adapter', context);
  } else {
    const wrap = isDecorated ? 'platform.selfGoverned(' : 'platform.adapter(ownPolicy(retry({ attempts: 3 }), timeout(2000))(';
    scope.ws.note(`Instantiate Remote${port} in ${module} and give it to the handlers that need it: ${wrap}new Remote${port}(), { kind: '${kind}', context: '${scope.context.kebab}' })${isDecorated ? '' : `, { kind: '${kind}', context: '${scope.context.kebab}' })`}.`);
  }
}

function bindingKind(scope: Scope): string {
  const kind = scope.flags.kind ?? 'external';
  if (ADAPTER_KINDS.includes(kind)) return kind;
  throw new CliError(`Unknown value "${kind}" for --kind.`, `Use one of: ${ADAPTER_KINDS.join(', ')} (external: a system outside the application; gateway: another bounded context).`);
}

function isBound(scope: Scope, port: string): boolean {
  const module = scope.ws.read(`${scope.dir}/${scope.context.kebab}.module.ts`) ?? '';
  return module.includes(`token<${port}>(`);
}
