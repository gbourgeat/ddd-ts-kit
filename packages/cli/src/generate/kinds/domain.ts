import { refreshContextDoc } from '../../docs/context-doc.js';
import { CliError } from '../../errors.js';
import { emit, requireFile } from '../emit.js';
import type { Kind } from '../kind.js';
import { concept, eventNames, learnTerms, type EventNames } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';
import type { Name } from '../../naming.js';

export const aggregateKind: Kind = {
  name: 'aggregate',
  aliases: [],
  usage: 'aggregate <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'An aggregate root with create and rehydrate factories, its test data builder and its spec.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const name = concept(scope, request.args[1] ?? '', { what: 'aggregate', strip: ['aggregate'] });
    const context = vars(scope, { name: named(name), aggregate: named(name) });
    emit(scope, context, [
      ['aggregate/aggregate.ts.tpl', `domain/aggregates/${name.kebab}.aggregate.ts`],
      ['builder/builder.ts.tpl', `test/builders/${name.kebab}.builder.ts`],
      ['aggregate/aggregate.spec.ts.tpl', `test/unit/${name.kebab}.aggregate.spec.ts`],
    ]);
    refreshContextDoc(scope.ws, scope.config, scope.context.kebab);
  },
};

export const builderKind: Kind = {
  name: 'builder',
  aliases: [],
  usage: 'builder <context> <Aggregate>',
  summary: 'The test data builder of an existing aggregate, in test/builders/.',
  positionals: ['context', 'Aggregate'],
  run: (request) => {
    const scope = openScope(request);
    const aggregate = existingAggregate(scope, request.args[1] ?? '');
    emit(scope, vars(scope, { aggregate: named(aggregate) }), [['builder/builder.ts.tpl', `test/builders/${aggregate.kebab}.builder.ts`]]);
  },
};

/** The name of an aggregate other kinds build on: it has to exist, its vocabulary was judged when it was created. */
export function existingAggregate(scope: Scope, input: string): Name {
  const aggregate = concept({ ...scope, flags: { ...scope.flags, allowName: true } }, input, { what: 'aggregate', strip: ['repository', 'builder'] });
  requireFile(scope, {
    file: `domain/aggregates/${aggregate.kebab}.aggregate.ts`,
    what: `The aggregate ${aggregate.pascal}`,
    createdBy: `ddd-ts-kit generate aggregate ${scope.context.kebab} ${aggregate.pascal}`,
  });
  return aggregate;
}

export const entityKind: Kind = {
  name: 'entity',
  aliases: [],
  usage: 'entity <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'An entity living inside an aggregate, and its spec.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const name = concept(scope, request.args[1] ?? '', { what: 'entity', strip: ['entity'] });
    emit(scope, vars(scope, { name: named(name) }), [
      ['entity/entity.ts.tpl', `domain/entities/${name.kebab}.entity.ts`],
      ['entity/entity.spec.ts.tpl', `test/unit/${name.kebab}.entity.spec.ts`],
    ]);
  },
};

export const valueObjectKind: Kind = {
  name: 'value-object',
  aliases: ['vo'],
  usage: 'value-object <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'An immutable value object validated in create, and its spec.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const name = concept(scope, request.args[1] ?? '', { what: 'value object', strip: ['vo'] });
    emit(scope, vars(scope, { name: named(name) }), [
      ['value-object/value-object.ts.tpl', `domain/value-objects/${name.kebab}.vo.ts`],
      ['value-object/value-object.spec.ts.tpl', `test/unit/${name.kebab}.vo.spec.ts`],
    ]);
  },
};

export const domainEventKind: Kind = {
  name: 'domain-event',
  aliases: [],
  usage: 'domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...',
  summary: 'A domain event named <context>.<aggregate>.<fact>, and its spec.',
  positionals: ['context', 'Aggregate', 'Fact'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    writeDomainEvent(scope, eventNames(scope, request.args[1] ?? '', request.args[2] ?? ''));
  },
};

/** Kinds that react to a domain event create it when it is missing, so their output always compiles. */
export function ensureDomainEvent(scope: Scope, aggregateInput: string, factInput: string): EventNames {
  const names = eventNames(scope, aggregateInput, factInput);
  if (!scope.ws.exists(`${scope.dir}/domain/events/${names.event.kebab}.event.ts`)) writeDomainEvent(scope, names);
  return names;
}

export function eventVars(scope: Scope, names: EventNames, extra: Record<string, string | number> = {}) {
  return vars(scope, { aggregate: named(names.aggregate), event: { ...named(names.event), name: names.eventName, ...extra } });
}

function writeDomainEvent(scope: Scope, names: EventNames): void {
  emit(scope, eventVars(scope, names), [
    ['domain-event/domain-event.ts.tpl', `domain/events/${names.event.kebab}.event.ts`],
    ['domain-event/domain-event.spec.ts.tpl', `test/unit/${names.event.kebab}.event.spec.ts`],
  ]);
}

export const domainErrorKind: Kind = {
  name: 'domain-error',
  aliases: [],
  usage: 'domain-error <context> <Name> [--code CODE]',
  summary: 'A DomainError with a stable code, and its spec.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    const name = concept({ ...scope, flags: { ...scope.flags, allowName: true } }, request.args[1] ?? '', { what: 'domain error', strip: ['error'] });
    const code = request.flags.code ?? name.constant;
    if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(code)) {
      throw new CliError(`"${code}" is not a valid error code.`, 'Use upper-case words separated by underscores, for example INVOICE_ALREADY_ISSUED.');
    }
    emit(scope, vars(scope, { name: named(name), error: { code } }), [
      ['domain-error/domain-error.ts.tpl', `domain/errors/${name.kebab}.error.ts`],
      ['domain-error/domain-error.spec.ts.tpl', `test/unit/${name.kebab}.error.spec.ts`],
    ]);
  },
};

export const domainServiceKind: Kind = {
  name: 'domain-service',
  aliases: [],
  usage: 'domain-service <context> <Name> [--term "<Term>=<meaning>"]...',
  summary: 'A stateless domain service, and its spec.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const name = concept(scope, request.args[1] ?? '', { what: 'domain service', strip: ['service'] });
    emit(scope, vars(scope, { name: named(name) }), [
      ['domain-service/domain-service.ts.tpl', `domain/services/${name.kebab}.service.ts`],
      ['domain-service/domain-service.spec.ts.tpl', `test/unit/${name.kebab}.service.spec.ts`],
    ]);
  },
};
