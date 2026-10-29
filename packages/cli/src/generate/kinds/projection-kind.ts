import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import { parseContextName, toName, type Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { emit } from '../emit';
import { label } from '../label';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { wiringFamily } from '../wiring-family';
import { subscriptionVars } from './subscription-vars';
import type { EventDeclaration } from './event-declaration';
import { findEventDeclaration } from './find-event-declaration';
import { ownEntry } from '../../config/values/own-entry';

export const projectionKind: Kind = {
  name: 'projection',
  aliases: ['projector'],
  usage: 'projection <context> <Name> <eventType> [--term "<Term>=<meaning>"]...',
  summary:
    'A projector, the class that keeps one read model up to date from integration events of its own context or of a declared upstream, and its spec; registered in the module file of its context in the explicit style.',
  positionals: ['context', 'Name', 'eventType'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = label(scope, request.args[1] ?? '', { what: 'projection', strip: ['projection', 'projector'] });

    const eventType = request.args[2] ?? '';
    const publisher = publisherOf(scope, eventType);
    const declaration = findEventDeclaration(scope, publisher.kebab, eventType);

    if (declaration === undefined) {
      throw undeclaredEvent(publisher, eventType);
    }

    const context = vars(scope, {
      name: named(name),
      publisher: named(publisher),
      event: eventVars(eventType, declaration),
      consumer: subscriptionVars(scope, true),
    });

    // Without a container to include a declared class in (a hand-wired platform), the class is plain and subscribed by hand.
    const source =
      wiringFamily(scope.config) === 'manual' ? 'projection/projection.manual.ts.tpl' : 'projection/projection.ts.tpl';

    emit(scope, context, [
      [source, `application/projections/${name.kebab}.projection.ts`],
      ['projection/projection.spec.ts.tpl', `test/unit/${name.kebab}.projection.spec.ts`],
    ]);

    wire(scope, 'projection', context);
  },
};

/** The context that publishes the event: this one, or one of its declared upstreams. */
function publisherOf(scope: Scope, eventType: string): Name {
  const parts = eventType.split('.');

  if (parts.length !== 3 || !parts.every((part) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(part))) {
    throw new CliError(
      `"${eventType}" is not the type of an integration event.`,
      `Pass the type as published, <context>.<aggregate>.<fact> in kebab-case, for example ${scope.context.kebab}.invoice.issued.`,
    );
  }

  const publisher = parseContextName(parts[0] ?? '');
  const upstreams = ownEntry(scope.config.contexts, scope.context.kebab)?.upstreams ?? [];

  if (publisher.kebab === scope.context.kebab || upstreams.some(({ context }) => context === publisher.kebab)) {
    return publisher;
  }

  throw new CliError(
    `"${scope.context.kebab}" does not declare "${publisher.kebab}" as an upstream.`,
    `If ${scope.context.kebab} really keeps a read model from what ${publisher.kebab} announces, add { "context": "${publisher.kebab}", "relationship": "published-language" } to contexts.${scope.context.kebab}.upstreams in ${CONFIG_FILE}, then run the command again.`,
  );
}

function undeclaredEvent(publisher: Name, eventType: string): CliError {
  const [, aggregate = '', fact = ''] = eventType.split('.');

  return new CliError(
    `${publisher.kebab} declares no ${eventType} in its published language.`,
    `A projection applies an event through its declaration, @On(<definition>): create it first with \`ddd-ts-kit generate integration-event ${publisher.kebab} ${toName(aggregate).pascal} ${toName(fact).pascal}\`, then run the command again.`,
  );
}

function eventVars(eventType: string, declaration: EventDeclaration): RenderContext {
  const [, aggregate = '', fact = ''] = eventType.split('.');

  return {
    type: eventType,
    definition: declaration.definition,
    typeName: declaration.typeName,
    method: toName(fact).camel,
    // The one field a generated declaration starts with: the spec builds its sample event from it.
    payloadKey: `${toName(aggregate).camel}Id`,
    payloadSample: `${aggregate}-1`,
  };
}
