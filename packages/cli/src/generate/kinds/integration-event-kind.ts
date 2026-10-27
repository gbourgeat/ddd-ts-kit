import { refreshContextDoc } from '../../docs/refresh-context-doc';
import { CliError } from '../../cli-error';
import { toName } from '../../naming';
import type { RenderContext } from '../../templating';
import { renderTemplate } from '../../templating';
import { applyWiring } from '../apply-wiring';
import { emit, type Output } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { ensureDomainEvent } from './ensure-domain-event';
import { assertDeclaresItsName } from './assert-declares-its-name';
import { eventNameReference } from './event-name-reference';
import { publishInIndex } from './publish-in-index';

export const integrationEventKind: Kind = {
  name: 'integration-event',
  aliases: [],
  usage: 'integration-event <context> <Aggregate> <Fact> [--version <n>] [--term "<Term>=<meaning>"]...',
  summary: 'A versioned declaration in the published language, its publisher, its spec and its registration.',
  positionals: ['context', 'Aggregate', 'Fact'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const version = parseVersion(request.flags.version);
    const names = ensureDomainEvent(scope, request.args[1] ?? '', request.args[2] ?? '');

    assertDeclaresItsName(scope, names);

    const publisher = toName(version === 1 ? names.event.words : `${names.event.words} v${version}`);
    const reference = eventNameReference(scope, names);
    const event = { ...named(names.event), name: names.eventName, reference, version };
    const context = vars(scope, { aggregate: named(names.aggregate), event, publisher: named(publisher) });
    const published = publishedFiles(scope, `${names.event.kebab}.v${version}`);

    emit(scope, context, [
      ...published.map(({ template, file }): Output => [template, `published-language/${file}.ts`]),
      ['integration-event/publisher.ts.tpl', `application/integration/publishers/${publisher.kebab}.publisher.ts`],
      ['integration-event/publisher.spec.ts.tpl', `test/unit/${publisher.kebab}.publisher.spec.ts`],
    ]);

    publish(
      scope,
      published.map(({ file }) => file),
      context,
    );
  },
};

interface PublishedFile {
  readonly template: string;
  readonly file: string;
}

/** The declaration of the event, and its payload in a file of its own where the schema library has it written as a class or an interface. */
function publishedFiles(scope: Scope, event: string): PublishedFile[] {
  const flavour = schemaFlavour(scope);

  const payload =
    flavour === 'zod' ? [] : [{ template: `integration-event/payload.${flavour}.ts.tpl`, file: `${event}.payload` }];

  return [
    ...payload,
    { template: `integration-event/integration-event.${flavour}.ts.tpl`, file: `${event}.integration-event` },
  ];
}

/** The declaration joins the published language, the lists of the context and, with the audit trail on, the events whose occurrence is recorded (never their payload). */
function publish(scope: Scope, files: readonly string[], context: RenderContext): void {
  const registry = `${scope.config.platformDir}/audit/audited-events.ts`;

  for (const file of files) {
    publishInIndex(scope, `${scope.dir}/published-language`, file);
  }

  refreshContextDoc(scope.ws, scope.config, scope.context.kebab);
  wire(scope, 'integration-event', context);

  if (scope.ws.exists(registry)) {
    applyWiring(scope.ws, registry, renderTemplate('integration-event/audited.tpl', context));
  }
}

function parseVersion(input: string | undefined): number {
  const version = Number(input ?? '1');

  if (Number.isInteger(version) && version >= 1) {
    return version;
  }

  throw new CliError(
    `"${input}" is not a valid version.`,
    'Pass --version with a positive integer; bump it only for a breaking change of the payload.',
  );
}

function schemaFlavour(scope: Scope): string {
  const { validation } = scope.config.stack;

  return validation === 'zod' || validation === 'class-validator' ? validation : 'custom';
}
