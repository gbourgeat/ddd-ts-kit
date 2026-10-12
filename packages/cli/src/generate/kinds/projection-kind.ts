import { CONFIG_FILE } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import { parseConceptName, parseContextName, toName, type Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { emit } from '../emit.js';
import { isDeclared } from '../is-declared.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import type { EventDeclaration } from './event-declaration.js';
import { findEventDeclaration } from './find-event-declaration.js';

export const projectionKind: Kind = {
  name: 'projection',
  aliases: ['projector'],
  usage: 'projection <context> <Name> <eventType> [--term "<Term>=<meaning>"]...',
  summary:
    'A projector, the class that keeps one read model up to date from integration events of its own context or of a declared upstream, and its spec: declared style only.',
  positionals: ['context', 'Name', 'eventType'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    if (!isDeclared(scope.config)) {
      throw explicitStyle();
    }

    learnTerms(scope);

    const name = parseConceptName(request.args[1] ?? '', 'projection', {
      allowName: scope.flags.allowName,
      strip: ['projection', 'projector'],
    });

    const eventType = request.args[2] ?? '';
    const publisher = publisherOf(scope, eventType);
    const declaration = findEventDeclaration(scope, publisher.kebab, eventType);

    if (declaration === undefined) {
      throw undeclaredEvent(publisher, eventType);
    }

    emit(
      scope,
      vars(scope, { name: named(name), publisher: named(publisher), event: eventVars(eventType, declaration) }),
      [
        ['projection/projection.ts.tpl', `application/projections/${name.kebab}.projection.ts`],
        ['projection/projection.spec.ts.tpl', `test/unit/${name.kebab}.projection.spec.ts`],
      ],
    );
  },
};

function explicitStyle(): CliError {
  return new CliError(
    'A projection declares itself with @Projection, which only the declared style assembles.',
    `Set "stack.style" to "declared" in ${CONFIG_FILE}, or write the class by hand in application/projections/ and add it to the module file of its context with \`builder.include(<Name>Projection)\`.`,
  );
}

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
  const upstreams = scope.config.contexts[scope.context.kebab]?.upstreams ?? [];

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
