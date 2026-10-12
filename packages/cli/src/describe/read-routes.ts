import type { RequestPart, RouteFact, RouteResponse, UseCaseFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { readControllers } from './read-controllers.js';

const FOLDER = 'presentation/http';

/**
 * The routes of a context: one per `*.route.ts` file, as its `defineRoute` call writes it, and
 * one per `*.controller.ts` file, as its decorator and its groups say it.
 */
export function readRoutes(sources: ContextSources, useCases: readonly UseCaseFact[]): RouteFact[] {
  const { ws, directory } = sources;

  const functions = ws
    .list(`${directory}/${FOLDER}`)
    .filter((file) => file.endsWith('.route.ts'))
    .map((file) =>
      routeOf(`${directory}/${FOLDER}/${file}`, ws.read(`${directory}/${FOLDER}/${file}`) ?? '', useCases),
    );

  return [...functions, ...readControllers(sources, useCases)].sort(
    (left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method),
  );
}

function routeOf(file: string, source: string, useCases: readonly UseCaseFact[]): RouteFact {
  const field = (key: string): string => new RegExp(String.raw`\b${key}:\s*'([^']*)'`).exec(source)?.[1] ?? '';
  const sent = /\bnew (\w+?)(Command|Query)\(/.exec(source);
  const kind = sent?.[2] === 'Query' ? 'query' : 'command';
  const useCase = sent?.[1] ?? '';

  return {
    method: field('method'),
    path: field('path'),
    operationId: field('operationId'),
    group: '',
    guards: [],
    useCase,
    permission: useCases.find((candidate) => candidate.kind === kind && candidate.name === useCase)?.permission ?? '',
    request: requestOf(source),
    responses: responsesOf(source),
    errors: [...(/\berrors:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      (match) => match[1] ?? '',
    ),
    file,
  };
}

function requestOf(source: string): RequestPart[] {
  const written = /\brequest:\s*\{([^{}]*)\}/.exec(source)?.[1] ?? '';

  return written
    .split(',')
    .map((entry) => entry.split(':').map((side) => side.trim()))
    .filter(([part]) => part !== undefined && part !== '')
    .map(([part = '', schema]) => ({ part, schema: schemaName(source, schema ?? part) }));
}

function responsesOf(source: string): RouteResponse[] {
  return [...source.matchAll(/\b(\d{3}):\s*\{\s*description:([^{}]*)\}/g)].map((match) => {
    const body = /\bbody:\s*([\w.]+(?:\(\w+\))?)\s*,?\s*$/.exec(match[2] ?? '')?.[1];

    return { status: Number(match[1]), schema: body === undefined ? '' : schemaName(source, body) };
  });
}

/** The class a schema constant validates with, when it names one; else the constant, which is all the route file says. */
function schemaName(source: string, written: string): string {
  const page = /^pageSchemaOf\((\w+)\)$/.exec(written)?.[1];

  if (page !== undefined) {
    return `page of ${schemaName(source, page)}`;
  }

  return new RegExp(String.raw`\bconst ${written} = classSchema\((\w+)`).exec(source)?.[1] ?? written;
}
