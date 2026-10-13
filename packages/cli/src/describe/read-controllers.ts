import { filesUnder } from '../generate/files-under.js';
import type { RequestPart, RouteFact, RouteResponse, UseCaseFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { decoratorOptions } from './decorator-options.js';
import { listedIn } from './listed-in.js';
import { presentationOfRoute } from './presentation-of-route.js';
import { readRouteGroups } from './read-route-groups.js';
import type { RouteGroupFact } from './route-group-fact.js';

const FOLDER = 'presentation/http';
const PARTS = ['params', 'query', 'headers', 'body'];

/** What the guards of the kit document on the routes behind them. */
const GUARD_ERRORS: Readonly<Record<string, readonly string[]>> = {
  Authenticated: ['UNAUTHORIZED'],
  HasRole: ['UNAUTHORIZED', 'FORBIDDEN'],
};

interface Read {
  readonly file: string;
  readonly source: string;
  /** The text of the mapper next to the controller, where the message is built when there is one. */
  readonly mapper: string;
  readonly options: string;
}

/** The routes the controllers of a context declare, one per `*.controller.ts` file, with what their groups add. */
export function readControllers(sources: ContextSources, useCases: readonly UseCaseFact[]): RouteFact[] {
  const { ws, directory } = sources;
  const groups = readRouteGroups(ws, directory);

  return filesUnder(ws, `${directory}/${FOLDER}`)
    .filter((file) => file.endsWith('.controller.ts'))
    .flatMap((file) => {
      const path = `${directory}/${FOLDER}/${file}`;
      const source = ws.read(path) ?? '';
      const options = decoratorOptions(source, 'Controller');
      const mapper = ws.read(path.replace(/\.controller\.ts$/, '.mapper.ts')) ?? '';

      return options === undefined ? [] : [routeOf({ file: path, source, mapper, options }, groups, useCases)];
    });
}

function routeOf(read: Read, groups: ReadonlyMap<string, RouteGroupFact>, useCases: readonly UseCaseFact[]): RouteFact {
  const { source, options, file } = read;
  const group = groups.get(/\bgroup:\s*([A-Za-z_$][\w$]*)/.exec(options)?.[1] ?? '') ?? NO_GROUP;
  const guards = [...group.guards, ...listedIn(options, 'guards')];
  const { kind, useCase } = sentBy(read);
  const sent = useCases.find((candidate) => candidate.kind === kind && candidate.name === useCase);
  const operationId = field(options, 'operationId') || operationIdOf(source);

  return {
    method: field(options, 'method'),
    path: pathOf(field(options, 'path'), group.prefix),
    operationId,
    group: group.name,
    guards,
    useCase,
    permission: sent === undefined ? '' : sent.permission,
    request: requestOf(source, options),
    responses: responsesOf(source, options),
    errors: errorsOf(options, group, guards),
    ...presentationOfRoute(options, operationId),
    file,
  };
}

const NO_GROUP: RouteGroupFact = { name: '', prefix: '', guards: [], errors: [], tags: [] };

function field(options: string, key: string): string {
  const [, written = ''] = new RegExp(String.raw`\b${key}:\s*'([^']*)'`).exec(options) ?? [];

  return written;
}

/** The root of a group is its prefix itself. */
function pathOf(written: string, prefix: string): string {
  return written === '/' && prefix !== '' ? prefix : `${prefix}${written}`;
}

function sentBy({ source, mapper }: Read): { kind: 'command' | 'query'; useCase: string } {
  const sent = /\bnew (\w+?)(Command|Query)\(/.exec(source) ?? /\bnew (\w+?)(Command|Query)\(/.exec(mapper);
  const named = /export\s+class\s+(\w+?)Controller\b/.exec(source)?.[1] ?? '';

  if (sent !== null) {
    return { kind: sent[2] === 'Query' ? 'query' : 'command', useCase: sent[1] ?? '' };
  }

  return { kind: /\bQueryBus\b/.test(source) ? 'query' : 'command', useCase: named };
}

function operationIdOf(source: string): string {
  const name = /export\s+class\s+(\w+?)Controller\b/.exec(source)?.[1] ?? '';

  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function errorsOf(options: string, group: RouteGroupFact, guards: readonly string[]): string[] {
  const own = listedIn(options, 'errors').map((entry) => entry.replace(/^['"]|['"]$/g, ''));
  const guarded = guards.flatMap((guard) => GUARD_ERRORS[guard.replace(/\(.*$/, '')] ?? []);

  return [...new Set([...guarded, ...group.errors, ...own])];
}

const RESPONSE = /\bresponse:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/;

function requestOf(source: string, options: string): RequestPart[] {
  // The response has a body of its own: only what stands outside it is a part of the request.
  const outside = options.replace(RESPONSE, '');

  return PARTS.flatMap((part) => {
    const written = new RegExp(String.raw`(?:^|[\n,{])\s*${part}(?::\s*([^,\n]+?))?\s*,`).exec(outside);

    return written === null ? [] : [{ part, schema: schemaName(source, written[1] ?? part) }];
  });
}

function responsesOf(source: string, options: string): RouteResponse[] {
  const response = RESPONSE.exec(options)?.[1] ?? '';
  const status = /\bstatus:\s*(\d{3})/.exec(response)?.[1];
  const body = /\bbody:\s*([\w.]+(?:\([\w.()]+\))?)/.exec(response)?.[1];

  return status === undefined
    ? []
    : [{ status: Number(status), schema: body === undefined ? '' : schemaName(source, body) }];
}

/** The class a schema validates with, when it names one; else what the controller writes. */
function schemaName(source: string, written: string): string {
  const page = /^pageSchemaOf\((.+)\)$/.exec(written)?.[1];

  if (page !== undefined) {
    return `page of ${schemaName(source, page)}`;
  }

  const inline = /^classSchema\((\w+)/.exec(written)?.[1];

  return inline ?? new RegExp(String.raw`\bconst ${written} = classSchema\((\w+)`).exec(source)?.[1] ?? written;
}
