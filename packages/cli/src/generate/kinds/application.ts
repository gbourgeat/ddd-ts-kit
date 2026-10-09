import { CliError } from '../../errors.js';
import type { Name } from '../../naming.js';
import type { RenderContext } from '../../render.js';
import { accessVars, specVars } from '../access.js';
import { emit, wire } from '../emit.js';
import type { Kind } from '../kind.js';
import { concept, label, learnTerms } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';
import { ensureDomainEvent, eventVars, existingAggregate } from './domain.js';
import { generateRepository } from './repository.js';

export const commandKind: Kind = {
  name: 'command',
  aliases: [],
  usage: 'command <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...',
  summary: 'A command, its handler with injected ports, its spec and its registration on the command bus.',
  positionals: ['context', 'UseCaseName'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const name = concept(scope, request.args[1] ?? '', { what: 'use case', strip: ['command', 'handler'] });
    const aggregate = request.flags.aggregate === undefined ? undefined : existingAggregate(scope, request.flags.aggregate);
    const access = accessVars(scope, { name, kind: 'Command' });
    if (aggregate !== undefined && !scope.ws.exists(`${scope.dir}/domain/repositories/${aggregate.kebab}.repository.ts`)) {
      generateRepository(scope, aggregate);
    }
    const spec = specVars(scope, access, aggregate === undefined ? [] : [`${aggregate.constant}_REPOSITORY`]);
    const context = vars(scope, { name: named(name), access, spec, ...commandVars(aggregate) });
    const folder = `application/commands/${name.kebab}`;
    emit(scope, context, [
      ['command/command.ts.tpl', `${folder}/${name.kebab}.command.ts`],
      ['command/handler.ts.tpl', `${folder}/${name.kebab}.handler.ts`],
      [`command/handler.spec.${scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses'}.ts.tpl`, `test/unit/${name.kebab}.handler.spec.ts`],
    ]);
    wire(scope, 'command', context);
  },
};

function commandVars(aggregate: Name | undefined) {
  return {
    command: { hasAggregate: aggregate !== undefined, result: aggregate === undefined ? 'void' : 'string' },
    ...(aggregate === undefined ? {} : { aggregate: named(aggregate) }),
  };
}

export const queryKind: Kind = {
  name: 'query',
  aliases: [],
  usage: 'query <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--list] [--term "<Term>=<meaning>"]...',
  summary: 'A query, its handler, its read port with an in-memory adapter and a fake, its spec and its registration on the query bus; with --list, one page of a list filtered by the access scope of the actor.',
  positionals: ['context', 'UseCaseName'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const name = concept(scope, request.args[1] ?? '', { what: 'use case', strip: ['query', 'handler'] });
    const access = accessVars(scope, { name, kind: 'Query' });
    const variant = queryVariant(scope, access);
    const context = vars(scope, { name: named(name), access, spec: specVars(scope, access, [`${name.constant}_READER`]), list: { resource: listedResource(access) } });
    const folder = `application/queries/${name.kebab}`;
    emit(scope, context, [
      [`query/${variant}query.ts.tpl`, `${folder}/${name.kebab}.query.ts`],
      [`query/${variant}handler.ts.tpl`, `${folder}/${name.kebab}.handler.ts`],
      [`query/${variant}reader.port.ts.tpl`, `application/ports/${name.kebab}-reader.port.ts`],
      [`query/${variant}reader.in-memory.ts.tpl`, `infrastructure/persistence/in-memory-${name.kebab}.reader.ts`],
      ['query/reader.fake.ts.tpl', `test/fakes/${name.kebab}-reader.fake.ts`],
      [`query/${variant}handler.spec.${scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses'}.ts.tpl`, `test/unit/${name.kebab}.handler.spec.ts`],
    ]);
    wire(scope, variant === '' ? 'query' : 'query/list', context);
  },
};

/** `--list`: the templates of a paginated list. A list is narrowed by what its actor may see, so it names a permission. */
function queryVariant(scope: Scope, access: RenderContext): '' | 'list.' {
  if (!scope.flags.list) return '';
  if (access['protected'] === true) return 'list.';
  throw new CliError(
    '--list cannot be combined with --public.',
    'A generated list is filtered by the access scope the authorizer computes for its actor: give it --permission <aggregate>.<action>, or generate a plain public query and page it yourself.',
  );
}

/** The element a list shows, as the authorization model names it: the aggregate of its permission, to start with. */
function listedResource(access: RenderContext): string {
  const permission = access['permission'];
  return typeof permission === 'string' ? (permission.split('.')[0] ?? '') : '';
}

export const portKind: Kind = {
  name: 'port',
  aliases: [],
  usage: 'port <context> <Name>',
  summary: 'A port of the application layer and its fake.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'port', strip: ['port'] });
    emit(scope, vars(scope, { name: named(name) }), [
      ['port/port.ts.tpl', `application/ports/${name.kebab}.port.ts`],
      ['port/fake.ts.tpl', `test/fakes/${name.kebab}.fake.ts`],
    ]);
    scope.ws.note(`${name.pascal} has no adapter yet: implement it in infrastructure/external and bind it in ${scope.context.kebab}.module.ts.`);
  },
};

export const eventHandlerKind: Kind = {
  name: 'event-handler',
  aliases: [],
  usage: 'event-handler <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...',
  summary: 'A reaction to a domain event of the same context, its spec and its subscription.',
  positionals: ['context', 'Aggregate', 'Fact'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const names = ensureDomainEvent(scope, request.args[1] ?? '', request.args[2] ?? '');
    const context = eventVars(scope, names);
    emit(scope, context, [
      ['event-handler/event-handler.ts.tpl', `application/event-handlers/${names.event.kebab}.event-handler.ts`],
      ['event-handler/event-handler.spec.ts.tpl', `test/unit/${names.event.kebab}.event-handler.spec.ts`],
    ]);
    wire(scope, 'event-handler', context);
  },
};
