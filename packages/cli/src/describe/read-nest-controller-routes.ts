import { scan } from '../check/scan/scan';
import type { ClassShape } from '../check/structure/class-shape';
import { readStructure } from '../check/structure/read-structure';
import type { NestAnswer } from '../nest-controllers/nest-answer';
import type { NestControllerEntry, NestRouteMethod } from '../nest-controllers/nest-controller-entry';
import { nestControllersIn } from '../nest-controllers/nest-controllers-in';
import type { RequestPart, RouteFact, RouteResponse, UseCaseFact } from './context-description';
import type { ContextSources } from './context-sources';
import { decoratorOptions } from './decorator-options';
import { guardErrors } from './guard-errors';
import { listedIn } from './listed-in';
import { NO_GROUP } from './no-group';
import { presentationOfRoute } from './presentation-of-route';
import type { RouteGroupFact } from './route-group-fact';
import { schemaClassOf } from './schema-class-of';

/** Where the Nest controllers of one file are read: the sources of the context and the route groups they may name. */
export interface NestControllerFile {
  readonly sources: ContextSources;
  readonly file: string;
  readonly groups: ReadonlyMap<string, RouteGroupFact>;
}

/** What one route method of a Nest controller says, besides what its signature does. */
interface Written {
  readonly text: string;
  readonly controller: Controller;
  readonly method: NestRouteMethod;
  /** The decorators of the method, `@Post(...)`, `@HttpCode(...)` and `@KitRoute(...)`. */
  readonly decorators: string;
  readonly body: string;
}

/** What the class says for every route method: its path, its group, and the options of `@KitRoutes`. */
interface Controller {
  readonly path: string;
  readonly group: RouteGroupFact;
  readonly shared: string;
}

const VERB = /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*(?:'([^']*)')?/;

/**
 * The routes of the Nest controllers the kit serves in one file, one per route method: its method
 * and path from Nest's decorators under the prefix of its group, its parts and its answer from its
 * signature, its refusal codes, guards and presentation from `@KitRoute` and `@KitRoutes`.
 */
export function readNestControllerRoutes(
  { sources, file, groups }: NestControllerFile,
  useCases: readonly UseCaseFact[],
): RouteFact[] {
  const { ws, config } = sources;
  const text = ws.read(file) ?? '';
  const classes = readStructure(scan(text)).classes;
  const files = { read: (path: string) => ws.read(path), under: () => [] };

  return nestControllersIn(files, config, file).flatMap((entry) => {
    const shape = classes.find(({ name }) => name === entry.className);

    return shape === undefined
      ? []
      : methodsOf({ text, groups }, shape, entry).map((written) => routeOf(written, file, useCases));
  });
}

/** Each route method of the class, with its decorators and its body, and what the class says for all of them. */
function methodsOf(
  { text, groups }: { text: string; groups: ReadonlyMap<string, RouteGroupFact> },
  shape: ClassShape,
  entry: NestControllerEntry,
): Written[] {
  const decorators = text.slice(Math.max(0, shape.start - 400), shape.start);
  const shared = decoratorOptions(decorators, 'KitRoutes') ?? '';

  const controller: Controller = {
    path: /@Controller\(\s*'([^']*)'/.exec(decorators)?.[1] ?? '',
    group: groups.get(/\bgroup:\s*([A-Za-z_$][\w$]*)/.exec(shared)?.[1] ?? '') ?? NO_GROUP,
    shared,
  };

  let previous = shape.bodyStart;

  return shape.methods.flatMap((written) => {
    const before = text.slice(previous, written.start);
    const method = entry.methods.find(({ name }) => name === written.name);

    previous = written.end;

    return method === undefined
      ? []
      : [{ text, controller, method, decorators: before, body: text.slice(written.bodyStart, written.end) }];
  });
}

function routeOf(written: Written, file: string, useCases: readonly UseCaseFact[]): RouteFact {
  const { controller, method, decorators, body } = written;
  const options = decoratorOptions(decorators, 'KitRoute') ?? '';
  const [, verb = '', path = ''] = VERB.exec(decorators) ?? [];
  const { useCase, permission } = sentBy(body, useCases);
  const operationId = /\boperationId:\s*'([^']*)'/.exec(options)?.[1] ?? method.name;
  const guards = [...controller.group.guards, ...listedIn(controller.shared, 'guards'), ...listedIn(options, 'guards')];

  return {
    method: verb.toUpperCase(),
    path: pathOf(controller, path),
    operationId,
    group: controller.group.name,
    guards,
    useCase,
    permission,
    request: requestOf(written, options),
    responses: [responseOf(written, options, verb)],
    errors: errorsOf(controller, options, guards),
    ...presentationOfRoute(options, operationId),
    file,
  };
}

/** The use case the method sends a message of, and the permission it requires. */
function sentBy(body: string, useCases: readonly UseCaseFact[]): { useCase: string; permission: string } {
  const sent = /\bnew (\w+?)(Command|Query)\(/.exec(body);
  const kind = sent?.[2] === 'Query' ? 'query' : 'command';
  const useCase = sent?.[1] ?? '';
  const permission = useCases.find((candidate) => candidate.kind === kind && candidate.name === useCase)?.permission;

  return { useCase, permission: permission ?? '' };
}

/** What the guards answer, then the codes of the group, of the class and of the method. */
function errorsOf({ group, shared }: Controller, options: string, guards: readonly string[]): string[] {
  const listed = [...group.errors, ...listedIn(shared, 'errors'), ...listedIn(options, 'errors')];

  return [...new Set([...guardErrors(guards), ...listed.map((entry) => entry.replace(/^['"]|['"]$/g, ''))])];
}

/** The path of the group, then that of the class and that of the method, as Nest joins them. */
function pathOf({ path, group }: Controller, own: string): string {
  const rest = [path, own]
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter((part) => part !== '')
    .join('/');

  return rest === '' ? group.prefix || '/' : `${group.prefix}/${rest}`;
}

/** Each part a parameter takes whole, by its class, or by the schema `request` of `@KitRoute` gives instead. */
function requestOf({ text, method }: Written, options: string): RequestPart[] {
  const given = /\brequest:\s*\{([^{}]*)\}/.exec(options)?.[1] ?? '';

  return method.request.map(({ source, type, declared }) => {
    const member = new RegExp(String.raw`(?:^|,)\s*${source}\s*(?::\s*([\w.]+))?\s*(?:,|$)`).exec(given.trim());

    if (declared && member !== null) {
      return { part: source, schema: schemaClassOf(text, member[1] ?? source) };
    }

    return { part: source, schema: type.kind === 'class' ? type.name : type.text };
  });
}

/** The status `@KitRoute`, `@HttpCode` or Nest gives, with the body `@KitRoute` declares or the signature answers. */
function responseOf({ text, method, decorators }: Written, options: string, verb: string): RouteResponse {
  const response = /\bresponse:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/.exec(options)?.[1] ?? '';
  const declared = /\bstatus:\s*(\d{3})/.exec(response)?.[1] ?? /@HttpCode\(\s*(\d{3})\s*\)/.exec(decorators)?.[1];
  const body = /\bbody:\s*([\w.]+(?:\([\w.()]+\))?)/.exec(response)?.[1];

  return {
    status: declared === undefined ? (verb === 'Post' ? 201 : 200) : Number(declared),
    schema: body === undefined ? answered(method.answer) : schemaClassOf(text, body),
  };
}

function answered(answer: NestAnswer): string {
  if (answer.kind === 'accepted') {
    return 'acceptedSchema';
  }

  return answer.kind === 'class' ? answer.name : '';
}
