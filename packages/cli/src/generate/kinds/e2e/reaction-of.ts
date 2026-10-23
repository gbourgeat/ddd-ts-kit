import { CliError } from '../../../cli-error.js';
import type { ConsumedEventFact } from '../../../describe/context-description.js';
import type { ContextSources } from '../../../describe/context-sources.js';
import { readConsumedEvents } from '../../../describe/read-consumed-events.js';
import { readEventDefinitions } from '../../../describe/read-event-definitions.js';
import { readRoutes } from '../../../describe/read-routes.js';
import { toName, type Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';
import type { Scope } from '../../scope.js';
import { declaredModules } from '../../../model-modules/index.js';

/** What an end-to-end spec publishes to start a use case no route reaches, and where a client reads what followed. */
export interface Reaction {
  readonly upstream: RenderContext;
  readonly e2e: RenderContext;
}

/**
 * The integration event whose handler sends the command of the use case: the one named with
 * `--event`, or the only one a handler of the context sends that command for.
 */
export function reactionOf(scope: Scope, name: Name, routeFile: string): Reaction {
  const sources = sourcesOf(scope);
  const consumed = readConsumedEvents(sources);
  const useCase = { scope, name, consumed };
  const asked = scope.flags.event;
  const event = asked === undefined ? sentFor(useCase, routeFile) : handledOf(useCase, asked);

  const reads = readRoutes(sources, [])
    .filter((route) => route.method === 'GET')
    .map((route) => `GET ${route.path}`);

  return {
    upstream: upstreamVars(scope, event),
    e2e: { reads: reads.join(', '), readable: reads.length > 0, handlers: handlersOf(consumed, event.type) },
  };
}

/** A use case, in the context whose integration event handlers may send its command. */
interface UseCaseOf {
  readonly scope: Scope;
  readonly name: Name;
  /** The integration events the context handles, one per handler. */
  readonly consumed: readonly ConsumedEventFact[];
}

function sourcesOf(scope: Scope): ContextSources {
  const { ws, config, context, dir } = scope;

  return {
    ws,
    config,
    name: context.kebab,
    directory: dir,
    modules: declaredModules(config, context.kebab),
    module: ws.read(`${dir}/${context.kebab}.module.ts`) ?? '',
  };
}

/** The event of the handlers that send the command of the use case, when they all handle the same one. */
function sentFor(useCase: UseCaseOf, routeFile: string): ConsumedEventFact {
  const { scope, name, consumed } = useCase;
  const command = new RegExp(String.raw`\b${name.pascal}Command\b`);
  const senders = consumed.filter((fact) => command.test(scope.ws.read(fact.file) ?? ''));
  const types = [...new Set(senders.map((fact) => fact.type))];
  const [sender] = senders;

  if (sender === undefined) {
    throw noTrigger(useCase, routeFile);
  }

  if (types.length > 1) {
    throw new CliError(
      `Several integration event handlers of "${scope.context.kebab}" send ${name.pascal}Command: ${senders.map((fact) => `${fact.handler} (${fact.type})`).join(', ')}.`,
      `Name the event the spec publishes: \`ddd-ts-kit generate e2e ${scope.context.kebab} ${name.pascal} --event <eventType>\`, one of ${types.join(', ')}.`,
    );
  }

  return sender;
}

function noTrigger({ scope, name, consumed }: UseCaseOf, routeFile: string): CliError {
  const handled = consumed.length === 0 ? '' : ` (handled here: ${typesOf(consumed).join(', ')})`;

  return new CliError(
    `The use case ${name.pascal} has no route in "${scope.context.kebab}" (${routeFile}), and no integration event handler of it sends ${name.pascal}Command.`,
    `An end-to-end spec drives the application through HTTP, or through the integration event that starts the use case: create the route first with \`ddd-ts-kit generate route ${scope.context.kebab} ${name.pascal} --method <M> --path <path>\`, or name the event its handler receives with --event <context>.<aggregate>.<fact>${handled}.`,
  );
}

/** The event named with `--event`: a handler of the context receives it, and the command it starts exists. */
function handledOf({ scope, name, consumed }: UseCaseOf, asked: string): ConsumedEventFact {
  const command = `${scope.dir}/application/commands/${name.kebab}/${name.kebab}.command.ts`;

  if (!scope.ws.exists(command)) {
    throw new CliError(
      `The use case ${name.pascal} has no command in "${scope.context.kebab}" (${command}).`,
      `An integration event handler starts a command of its context: create it first with \`ddd-ts-kit generate command ${scope.context.kebab} ${name.pascal} --permission <aggregate>.<action>\`.`,
    );
  }

  const handled = consumed.find((fact) => fact.type === asked);

  if (handled !== undefined) {
    return handled;
  }

  const [upstream = '<upstreamContext>'] = asked.split('.');
  const create = `\`ddd-ts-kit generate integration-handler ${scope.context.kebab} ${upstream} ${asked}\``;

  throw new CliError(
    `No integration event handler of "${scope.context.kebab}" receives ${asked}.`,
    consumed.length === 0
      ? `Create the handler first with ${create}.`
      : `Pass --event with one of the events it handles, ${typesOf(consumed).join(', ')}, or create the handler first with ${create}.`,
  );
}

function typesOf(consumed: readonly ConsumedEventFact[]): string[] {
  return [...new Set(consumed.map((fact) => fact.type))];
}

function handlersOf(consumed: readonly ConsumedEventFact[], type: string): string {
  return consumed
    .filter((fact) => fact.type === type)
    .map((fact) => fact.handler)
    .join(', ');
}

/** The declaration the handler is given, when its upstream has one here: the spec builds the event from it. */
function upstreamVars(scope: Scope, event: ConsumedEventFact): RenderContext {
  const declared = readEventDefinitions(scope.ws, `${scope.config.contextsDir}/${event.from}`).find(
    (definition) => definition.type === event.type && definition.version === event.version,
  );

  const [, aggregate = ''] = event.type.split('.');

  return {
    ...toName(event.from),
    eventName: event.type,
    known: declared !== undefined,
    definition: declared?.name ?? '',
    version: event.version ?? 1,
    // The one field a generated declaration starts with.
    payloadKey: `${toName(aggregate).camel}Id`,
    payloadSample: `${aggregate}-1`,
  };
}
