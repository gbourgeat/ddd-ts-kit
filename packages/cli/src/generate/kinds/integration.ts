import { CONFIG_FILE } from '../../config.js';
import { refreshContextDoc } from '../../docs/context-doc.js';
import { CliError } from '../../errors.js';
import { parseContextName, toName, type Name } from '../../naming.js';
import { emit, wire } from '../emit.js';
import type { Kind } from '../kind.js';
import { label, learnTerms } from '../language.js';
import { named, openScope, vars, type Scope } from '../scope.js';
import { ensureDomainEvent } from './domain.js';

export const integrationEventKind: Kind = {
  name: 'integration-event',
  aliases: [],
  usage: 'integration-event <context> <Aggregate> <Fact> [--version <n>] [--term "<Term>=<meaning>"]...',
  summary: 'A versioned declaration in the published language, its publisher, its spec and its registration.',
  positionals: ['context', 'Aggregate', 'Fact'],
  run: (request) => {
    const scope = openScope(request);
    learnTerms(scope);
    const version = parseVersion(request.flags.version);
    const names = ensureDomainEvent(scope, request.args[1] ?? '', request.args[2] ?? '');
    const publisher = toName(version === 1 ? names.event.words : `${names.event.words} v${version}`);
    const context = vars(scope, {
      aggregate: named(names.aggregate),
      event: { ...named(names.event), name: names.eventName, version },
      publisher: named(publisher),
    });
    const declaration = `${names.event.kebab}.v${version}.integration-event`;
    emit(scope, context, [
      [`integration-event/integration-event.${schemaFlavour(scope)}.ts.tpl`, `published-language/${declaration}.ts`],
      ['integration-event/publisher.ts.tpl', `application/integration/publishers/${publisher.kebab}.publisher.ts`],
      ['integration-event/publisher.spec.ts.tpl', `test/unit/${publisher.kebab}.publisher.spec.ts`],
    ]);
    exportFromPublishedLanguage(scope, declaration);
    refreshContextDoc(scope.ws, scope.config, scope.context.kebab);
    wire(scope, 'integration-event', context);
  },
};

function parseVersion(input: string | undefined): number {
  const version = Number(input ?? '1');
  if (Number.isInteger(version) && version >= 1) return version;
  throw new CliError(`"${input}" is not a valid version.`, 'Pass --version with a positive integer; bump it only for a breaking change of the payload.');
}

function schemaFlavour(scope: Scope): string {
  const { validation } = scope.config.stack;
  return validation === 'zod' || validation === 'class-validator' ? validation : 'custom';
}

function exportFromPublishedLanguage(scope: Scope, declaration: string): void {
  const index = `${scope.dir}/published-language/index.ts`;
  const line = `export * from './${declaration}.js';`;
  const lines = (scope.ws.read(index) ?? '').split('\n').filter((existing) => existing.trim() !== '' && existing.trim() !== 'export {};');
  if (!lines.includes(line)) lines.push(line);
  const content = `${lines.join('\n')}\n`;
  if (scope.ws.exists(index)) scope.ws.update(index, content);
  else scope.ws.create(index, content);
}

export const consumerKind: Kind = {
  name: 'consumer',
  aliases: [],
  usage: 'consumer <context> <upstreamContext> <eventType>',
  summary: 'An idempotent consumer of an integration event of a declared upstream, its spec and its subscription.',
  positionals: ['context', 'upstreamContext', 'eventType'],
  run: (request) => {
    const scope = openScope(request);
    const upstream = declaredUpstream(scope, request.args[1] ?? '');
    const eventType = eventTypeOf(upstream, request.args[2] ?? '');
    const name = toName(eventType.split('.').join(' '));
    const declaration = findDeclaration(scope, upstream.kebab, eventType);
    const context = vars(scope, { name: named(name), upstream: upstreamVars(upstream, eventType, declaration) });
    emit(scope, context, [
      ['consumer/consumer.ts.tpl', `application/integration/consumers/${name.kebab}.consumer.ts`],
      ['consumer/consumer.spec.ts.tpl', `test/unit/${name.kebab}.consumer.spec.ts`],
    ]);
    wire(scope, 'consumer', context);
    if (declaration === undefined) {
      scope.ws.note(`No declaration of ${eventType} was found in ${upstream.kebab}/published-language: the consumer receives an untyped payload.`);
    }
  },
};

function declaredUpstream(scope: Scope, input: string): Name {
  const upstream = parseContextName(input);
  const declared = scope.config.contexts[scope.context.kebab]?.upstreams.some((candidate) => candidate.context === upstream.kebab) === true;
  if (declared) return upstream;
  throw new CliError(
    `"${scope.context.kebab}" does not declare "${upstream.kebab}" as an upstream.`,
    `If ${scope.context.kebab} really depends on ${upstream.kebab}, add { "context": "${upstream.kebab}", "relationship": "published-language" } to contexts.${scope.context.kebab}.upstreams in ${CONFIG_FILE}, then run the command again.`,
  );
}

function eventTypeOf(upstream: Name, input: string): string {
  const parts = input.split('.');
  const wellFormed = parts.length === 3 && parts.every((part) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(part)) && parts[0] === upstream.kebab;
  if (wellFormed) return input;
  throw new CliError(
    `"${input}" is not an event type of "${upstream.kebab}".`,
    `Pass the type as published, <context>.<aggregate>.<fact> in kebab-case, for example ${upstream.kebab}.invoice.issued.`,
  );
}

interface Declaration {
  readonly definition: string;
  readonly typeName: string;
  readonly version: number;
}

/** Looks for the declaration of `eventType` in the published language of an upstream of this repository. */
function findDeclaration(scope: Scope, upstream: string, eventType: string): Declaration | undefined {
  const directory = `${scope.config.contextsDir}/${upstream}/published-language`;
  const declarations = scope.ws
    .list(directory)
    .map((file) => scope.ws.read(`${directory}/${file}`) ?? '')
    .filter((content) => content.includes(`type: '${eventType}'`))
    .flatMap(declarationIn);
  // A new consumer has no reason to start on an old contract.
  return declarations.reduce<Declaration | undefined>((newest, candidate) => (newest === undefined || candidate.version > newest.version ? candidate : newest), undefined);
}

function declarationIn(content: string): Declaration[] {
  const definition = /export const (\w+) = defineIntegrationEvent\b/.exec(content)?.[1];
  const typeName = /export type (\w+) = IntegrationEvent</.exec(content)?.[1];
  const version = Number(/\bversion:\s*(\d+)/.exec(content)?.[1] ?? '1');
  return definition === undefined || typeName === undefined ? [] : [{ definition, typeName, version }];
}

function upstreamVars(upstream: Name, eventType: string, declaration: Declaration | undefined) {
  return {
    ...named(upstream),
    eventName: eventType,
    known: declaration !== undefined,
    eventType: declaration?.typeName ?? '',
    definition: declaration?.definition ?? '',
    version: declaration?.version ?? 1,
    import: `../../../../${upstream.kebab}/published-language/index.js`,
    moduleImport: `../${upstream.kebab}/published-language/index.js`,
  };
}

export const aclKind: Kind = {
  name: 'acl',
  aliases: [],
  usage: 'acl <context> <upstreamOrSystemName>',
  summary: 'An anti-corruption translator for the model of another context or system, and its spec.',
  positionals: ['context', 'upstreamOrSystemName'],
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'upstream', strip: ['translator'] });
    emit(scope, vars(scope, { name: named(name) }), [
      ['acl/translator.ts.tpl', `infrastructure/anti-corruption/${name.kebab}.translator.ts`],
      ['acl/translator.spec.ts.tpl', `test/unit/${name.kebab}.translator.spec.ts`],
    ]);
    const relationship = scope.config.contexts[scope.context.kebab]?.upstreams.find((candidate) => candidate.context === name.kebab)?.relationship;
    if (scope.config.contexts[name.kebab] !== undefined && relationship !== 'anti-corruption-layer') {
      scope.ws.note(`"${name.kebab}" is a context of this project: declare it in contexts.${scope.context.kebab}.upstreams with the relationship "anti-corruption-layer".`);
    }
  },
};
