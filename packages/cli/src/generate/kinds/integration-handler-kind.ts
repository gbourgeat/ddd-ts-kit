import { CONFIG_FILE } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import { parseContextName, toName, type Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { emit } from '../emit.js';
import { isDeclared } from '../is-declared.js';
import type { Kind } from '../kind.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import type { EventDeclaration } from './event-declaration.js';
import { findEventDeclaration } from './find-event-declaration.js';

export const integrationHandlerKind: Kind = {
  name: 'integration-handler',
  aliases: ['consumer'],
  usage: 'integration-handler <context> <upstreamContext> <eventType>',
  summary:
    'An idempotent handler of an integration event of a declared upstream, its spec and its subscription under a consumer name.',
  positionals: ['context', 'upstreamContext', 'eventType'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const upstream = declaredUpstream(scope, request.args[1] ?? '');
    const eventType = eventTypeOf(upstream, request.args[2] ?? '');
    const name = toName(eventType.split('.').join(' '));
    const declaration = findEventDeclaration(scope, upstream.kebab, eventType);

    if (declaration === undefined && isDeclared(scope.config)) {
      throw undeclaredEvent(upstream, eventType);
    }

    const context = vars(scope, {
      name: named(name),
      upstream: upstreamVars(upstream, eventType, declaration),
      consumer: subscriptionVars(scope, declaration !== undefined),
    });

    emit(scope, context, [
      [
        'integration-handler/integration-handler.ts.tpl',
        `application/integration/handlers/${name.kebab}.integration-handler.ts`,
      ],
      ['integration-handler/integration-handler.spec.ts.tpl', `test/unit/${name.kebab}.integration-handler.spec.ts`],
    ]);

    wire(scope, 'integration-handler', context);

    if (declaration === undefined) {
      scope.ws.note(
        `No declaration of ${eventType} was found in ${upstream.kebab}/published-language: the handler receives an untyped payload.`,
      );
    }
  },
};

/** A handler declares itself against the declaration of its event: without one there is nothing to handle. */
function undeclaredEvent(upstream: Name, eventType: string): CliError {
  const [, aggregate = '', fact = ''] = eventType.split('.');

  return new CliError(
    `${upstream.kebab} declares no ${eventType} in its published language.`,
    `An integration event handler declares itself with @IntegrationEventHandler(<definition>, ...), which needs the declaration of the event: create it first with \`ddd-ts-kit generate integration-event ${upstream.kebab} ${toName(aggregate).pascal} ${toName(fact).pascal}\`, then run the command again.`,
  );
}

/**
 * How a hand-wired handler subscribes. In the process, the subscription deduplicates; behind a
 * broker, each context listens under its own name and the mark commits with the work of the handler.
 */
function subscriptionVars(scope: Scope, isTyped: boolean): RenderContext {
  const external = scope.config.stack.broker !== 'none';

  return {
    declarative: isTyped && !external,
    transactional: isTyped && external,
    untyped: !isTyped,
    subscriber: external ? `platform.subscriberFor('${scope.context.kebab}')` : 'platform.subscriber',
  };
}

function declaredUpstream(scope: Scope, input: string): Name {
  const upstream = parseContextName(input);

  const declared =
    scope.config.contexts[scope.context.kebab]?.upstreams.some((candidate) => candidate.context === upstream.kebab) ===
    true;

  if (declared) {
    return upstream;
  }

  throw new CliError(
    `"${scope.context.kebab}" does not declare "${upstream.kebab}" as an upstream.`,
    `If ${scope.context.kebab} really depends on ${upstream.kebab}, add { "context": "${upstream.kebab}", "relationship": "published-language" } to contexts.${scope.context.kebab}.upstreams in ${CONFIG_FILE}, then run the command again.`,
  );
}

function eventTypeOf(upstream: Name, input: string): string {
  const parts = input.split('.');

  const wellFormed =
    parts.length === 3 && parts.every((part) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(part)) && parts[0] === upstream.kebab;

  if (wellFormed) {
    return input;
  }

  throw new CliError(
    `"${input}" is not an event type of "${upstream.kebab}".`,
    `Pass the type as published, <context>.<aggregate>.<fact> in kebab-case, for example ${upstream.kebab}.invoice.issued.`,
  );
}

function upstreamVars(upstream: Name, eventType: string, declaration: EventDeclaration | undefined): RenderContext {
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
