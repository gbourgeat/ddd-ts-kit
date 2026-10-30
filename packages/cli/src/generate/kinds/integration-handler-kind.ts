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
import { findEventDeclaration, type WantedEvent } from './find-event-declaration';
import { publishedVersions } from './published-versions';
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
    'An idempotent handler of an integration event of a declared upstream, its spec and its subscription under a consumer name.',
  positionals: ['context', 'upstreamContext', 'eventType'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const upstream = declaredUpstream(scope, request.args[1] ?? '');
    const { eventType, version } = typeAsPublished(upstream, request.args[2] ?? '', request.flags.version);

    const name = givenName(scope, toName(eventType.split('.').join(' ')), {
      what: 'integration handler',
      suffix: ['integration', 'handler'],
    });

    const declaration = declarationAt(scope, upstream, { type: eventType, version });

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

/** The declaration of the version asked for, the newest without one; a version the upstream does not publish is refused. */
function declarationAt(scope: Scope, upstream: Name, wanted: WantedEvent): EventDeclaration | undefined {
  const declaration = findEventDeclaration(scope, upstream.kebab, wanted);

  if (declaration === undefined && wanted.version !== undefined) {
    refuseUnpublishedVersion(publishedVersions(scope, upstream.kebab, wanted.type), wanted.type);
  }

  return declaration;
}

/** The type as `list` prints it, `<type>@v<n>`, or bare; `--version` says the same as the suffix, never something else. */
function typeAsPublished(
  upstream: Name,
  input: string,
  flag: string | undefined,
): { eventType: string; version: number | undefined } {
  const [, suffix] = input.split('@');
  const eventType = eventTypeOf(upstream, input);
  const fromSuffix = suffix === undefined ? undefined : versionOf(suffix.replace(/^v/, ''), input);
  const fromFlag = flag === undefined ? undefined : versionOf(flag, flag);

  if (fromSuffix !== undefined && fromFlag !== undefined && fromSuffix !== fromFlag) {
    throw new CliError(
      `"${input}" names version ${fromSuffix} and --version ${fromFlag} names another.`,
      'Pass the version once: <type>@v<n>, or --version <n>, or both when they agree.',
    );
  }

  return { eventType, version: fromSuffix ?? fromFlag };
}

function versionOf(text: string, shown: string): number {
  const version = Number(text);

  if (/^[0-9]+$/.test(text) && version >= 1) {
    return version;
  }

  throw new CliError(
    `"${shown}" is not a valid version.`,
    'Pass the type as `list` prints it, <type>@v<n> with n a positive integer, or --version <n>.',
  );
}

function refuseUnpublishedVersion(published: readonly number[], eventType: string): void {
  if (published.length === 0) {
    return;
  }

  const listed = published.map((each) => `v${each}`).join(', ');

  throw new CliError(
    `${eventType} is published at ${listed} only.`,
    `Pass one of ${published.map((each) => `${eventType}@v${each}`).join(', ')}, or the bare type for the newest.`,
  );
}

function eventTypeOf(upstream: Name, input: string): string {
  const [written = '', ...suffixes] = input.split('@');
  const parts = written.split('.');

  const wellFormed =
    suffixes.length <= 1 &&
    parts.length === 3 &&
    parts.every((part) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(part)) &&
    parts[0] === upstream.kebab;

  if (wellFormed) {
    return written;
  }

  throw new CliError(
    `"${input}" is not an event type of "${upstream.kebab}".`,
    `Pass the type as published, <context>.<aggregate>.<fact> in kebab-case, with or without @v<n>, for example ${upstream.kebab}.invoice.issued or ${upstream.kebab}.invoice.issued@v1.`,
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
