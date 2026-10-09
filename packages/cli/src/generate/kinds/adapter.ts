import { CliError } from '../../errors.js';
import type { RenderContext } from '../../render.js';
import { emit, requireFile, wire } from '../emit.js';
import type { Kind } from '../kind.js';
import { label } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';

const ADAPTER_KINDS = ['external', 'gateway'];

export const adapterKind: Kind = {
  name: 'adapter',
  aliases: [],
  usage: 'adapter <context> <Port> [--kind external|gateway] [--decorators]',
  summary: 'An infrastructure adapter of an existing port towards an outside system, its spec and its registration with a retry and timeout policy; with --decorators the class carries the policy itself.',
  positionals: ['context', 'Port'],
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });
    requireFile(scope, { file: `application/ports/${name.kebab}.port.ts`, what: `The port ${name.pascal}`, createdBy: `ddd-ts-kit generate port ${scope.context.kebab} ${name.pascal}` });
    const adapter = { kind: bindingKind(scope), decorated: decorated(scope) };
    const context = vars(scope, { name: named(name), adapter });
    emit(scope, context, [
      ['adapter/adapter.ts.tpl', `infrastructure/external/remote-${name.kebab}.adapter.ts`],
      ['adapter/adapter.spec.ts.tpl', `test/integration/remote-${name.kebab}.adapter.spec.ts`],
    ]);
    register(scope, context, { port: name.pascal, ...adapter });
  },
};

interface Registration {
  readonly port: string;
  readonly kind: string;
  readonly decorated: boolean;
}

/** Bound by the generator where the module declares its bindings; said in a note where the wiring is by hand or the port already has an adapter. */
function register(scope: Scope, context: RenderContext, { port, kind, decorated: isDecorated }: Registration): void {
  const module = `${scope.context.kebab}.module.ts`;
  if (isBound(scope, port)) {
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

/**
 * `--decorators` needs standard (TC39) decorators end to end. A project compiled with
 * `experimentalDecorators` (class-validator, NestJS) gives decorator syntax its legacy meaning in
 * every file, and the generated jest configuration does not transform the standard one.
 */
function decorated(scope: Scope): boolean {
  if (!scope.flags.decorators) return false;
  const { http, validation, tests } = scope.config.stack;
  const reason = http === 'nest' || validation === 'class-validator' ? 'its tsconfig sets experimentalDecorators, which gives every decorator of the project its legacy meaning' : tests === 'jest' ? 'its jest configuration does not transform standard decorators' : undefined;
  if (reason === undefined) return true;
  throw new CliError(
    `--decorators cannot be used in this project: ${reason}.`,
    'Run the command without --decorators: the same policy is then attached where the adapter is bound, with `.with(ownPolicy(retry(...), timeout(...)))`, which is the preferred form.',
  );
}

function isBound(scope: Scope, port: string): boolean {
  const module = scope.ws.read(`${scope.dir}/${scope.context.kebab}.module.ts`) ?? '';
  return module.includes(`token<${port}>(`);
}
