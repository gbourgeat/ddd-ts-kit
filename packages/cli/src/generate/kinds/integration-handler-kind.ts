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
import { declarationsOf } from './declarations-of';
import { eventTypeAsPublished } from './event-type-as-published';
import { pickDeclaration } from './pick-declaration';
import { refuseUnpublishedVersion } from './refuse-unpublished-version';
import type { WantedEvent } from './wanted-event';
import { subscriptionVars } from './subscription-vars';
import { givenName } from '../given-name';
import { learnTerms } from '../learn-terms';
import { ownEntry } from '../../config/values/own-entry';

export const integrationHandlerKind: Kind = {
  name: 'integration-handler',
  aliases: ['consumer'],
  usage:
    'integration-handler <context> <upstreamContext> <eventType>[@v<n>] [--version <n>] [--name <Name>] [--term "<Term>=<meaning>"]...',
  summary:
    'An idempotent handler of an integration event of a declared upstream, its spec and its subscription under a consumer name. After `generate integration-event <upstreamContext> <Aggregate> <Fact>` of its eventType.',
  positionals: ['context', 'upstreamContext', 'eventType'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const upstream = declaredUpstream(scope, request.args[1] ?? '');
    const { type: eventType, version } = wantedEvent(upstream, request.args[2] ?? '', request.flags.version);

    const name = givenName(scope, toName(eventType.split('.').join(' ')), {
      what: 'integration handler',
      suffix: ['integration', 'handler'],
    });

    const declaration = declarationAt(scope, upstream, { type: eventType, version });

    if (declaration === undefined && isDeclared(scope.config)) {
      throw undeclaredEvent(upstream, { type: eventType, version });
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
function undeclaredEvent(upstream: Name, { type, version }: WantedEvent): MissingPrerequisite {
  const [, aggregate = '', fact = ''] = type.split('.');
  const at = version === undefined ? '' : ` --version ${version}`;

  return new MissingPrerequisite(
    `${upstream.kebab} declares no ${type}${version === undefined ? '' : ` at v${version}`} in its published language.`,
    `An integration event handler declares itself with @IntegrationEventHandler(<definition>, ...), which needs the declaration of the event: create it first with \`ddd-ts-kit generate integration-event ${upstream.kebab} ${toName(aggregate).pascal} ${toName(fact).pascal}${at}\`, then run the command again.`,
  );
}

function declaredUpstream(scope: Scope, input: string): Name {
  const upstream = parseContextName(input);

  const declared =
    ownEntry(scope.config.contexts, scope.context.kebab)?.upstreams.some(
      (candidate) => candidate.context === upstream.kebab,
    ) === true;

  if (declared) {
    return upstream;
  }

  throw new CliError(
    `"${scope.context.kebab}" does not declare "${upstream.kebab}" as an upstream.`,
    `If ${scope.context.kebab} really depends on ${upstream.kebab}, add { "context": "${upstream.kebab}", "relationship": "published-language" } to contexts.${scope.context.kebab}.upstreams in ${CONFIG_FILE}, then run the command again.`,
  );
}

/** The declaration of the version asked for, the newest without one; a version that cannot be found is refused. */
function declarationAt(scope: Scope, upstream: Name, wanted: WantedEvent): EventDeclaration | undefined {
  const found = declarationsOf(scope, upstream.kebab, wanted.type);
  const declaration = pickDeclaration(scope, found, wanted.version);

  if (declaration === undefined && wanted.version !== undefined) {
    refuseUnpublishedVersion(found, wanted.type, wanted.version);

    throw undeclaredEvent(upstream, wanted);
  }

  return declaration;
}

/** The event type of the command line, `<type>[@v<n>]`, of the upstream, at the version it names. */
function wantedEvent(
  upstream: Name,
  input: string,
  flag: string | undefined,
): { type: string; version: number | undefined } {
  const { written, version } = eventTypeAsPublished(input, flag);
  const parts = written.split('.');

  const wellFormed =
    parts.length === 3 && parts.every((part) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(part)) && parts[0] === upstream.kebab;

  if (!wellFormed) {
    throw new CliError(
      `"${input}" is not an event type of "${upstream.kebab}".`,
      `Pass the type as published, <context>.<aggregate>.<fact> in kebab-case, with or without @v<n>, for example ${upstream.kebab}.invoice.issued or ${upstream.kebab}.invoice.issued@v1.`,
    );
  }

  return { type: written, version };
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
