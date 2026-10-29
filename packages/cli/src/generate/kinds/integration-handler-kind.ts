import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import { MissingPrerequisite } from '../missing-prerequisite';
import { parseContextName, toName, type Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { emit } from '../emit';
import { isDeclared } from '../is-declared';
import type { Kind } from '../kind';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import type { EventDeclaration } from './event-declaration';
import { findEventDeclaration } from './find-event-declaration';
import { subscriptionVars } from './subscription-vars';
import { givenName } from '../given-name';
import { learnTerms } from '../learn-terms';

export const integrationHandlerKind: Kind = {
  name: 'integration-handler',
  aliases: ['consumer'],
  usage: 'integration-handler <context> <upstreamContext> <eventType> [--name <Name>] [--term "<Term>=<meaning>"]...',
  summary:
    'An idempotent handler of an integration event of a declared upstream, its spec and its subscription under a consumer name.',
  positionals: ['context', 'upstreamContext', 'eventType'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const upstream = declaredUpstream(scope, request.args[1] ?? '');
    const eventType = eventTypeOf(upstream, request.args[2] ?? '');

    const name = givenName(scope, toName(eventType.split('.').join(' ')), {
      what: 'integration handler',
      suffix: ['integration', 'handler'],
    });

    const declaration = findEventDeclaration(scope, upstream.kebab, eventType);

    if (declaration === undefined && isDeclared(scope.config)) {
      throw undeclaredEvent(upstream, eventType);
    }

    const context = vars(scope, {
      name: named(name),
      upstream: { ...upstreamVars(upstream, eventType, declaration), ...typeRead(scope, declaration, eventType) },
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
function undeclaredEvent(upstream: Name, eventType: string): MissingPrerequisite {
  const [, aggregate = '', fact = ''] = eventType.split('.');

  return new MissingPrerequisite(
    `${upstream.kebab} declares no ${eventType} in its published language.`,
    `An integration event handler declares itself with @IntegrationEventHandler(<definition>, ...), which needs the declaration of the event: create it first with \`ddd-ts-kit generate integration-event ${upstream.kebab} ${toName(aggregate).pascal} ${toName(fact).pascal}\`, then run the command again.`,
  );
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

/** The script that writes the event catalog before 0.6 found a consumer by the type written out: such a project keeps it written out. */
const CATALOG_SCRIPT = 'scripts/events.ts';

/**
 * How the handler names the type it handles: read from the declaration of its upstream,
 * `invoiceIssuedV1.type`, or written out when there is none here, or when the event catalog
 * script of the project still reads it written out.
 */
function typeRead(
  scope: Scope,
  declaration: EventDeclaration | undefined,
  eventType: string,
): { readsType: boolean; typeRead: string } {
  const script = scope.ws.read(CATALOG_SCRIPT);
  const readsType = declaration !== undefined && (script === undefined || script.includes('typesByName'));

  return { readsType, typeRead: readsType ? `${declaration.definition}.type` : `'${eventType}'` };
}

function upstreamVars(upstream: Name, eventType: string, declaration: EventDeclaration | undefined): RenderContext {
  const [, aggregate = ''] = eventType.split('.');

  return {
    ...named(upstream),
    eventName: eventType,
    // The one field a generated declaration starts with: the spec builds its sample event from it.
    payloadKey: `${toName(aggregate).camel}Id`,
    payloadSample: `${aggregate}-1`,
    known: declaration !== undefined,
    eventType: declaration?.typeName ?? '',
    definition: declaration?.definition ?? '',
    version: declaration?.version ?? 1,
  };
}
