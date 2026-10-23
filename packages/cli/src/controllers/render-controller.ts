import type { HandleTypes } from './handle-types-of';
import type { FunctionRoute } from './function-route';
import type { MigratedGroup } from './migrated-group';

export interface ControllerParts {
  readonly route: FunctionRoute;
  readonly types: HandleTypes;
  /** Undefined for a route that named no security scheme: its controller is public and stands in no group. */
  readonly group: MigratedGroup | undefined;
  readonly body: string;
  /** The import of the group, already written for the project. */
  readonly groupImport: string;
}

const GUARD_ERRORS = ["'UNAUTHORIZED'"];

/** The text of the controller file: the imports of the route, its schemas, the class, the helpers it kept. */
export function renderController(parts: ControllerParts): string {
  const { route, types, body } = parts;
  const reads = /\brequest\b/.test(body);
  const signature = `async handle(${reads ? `request: ${types.request}` : ''}): Promise<${types.result}>`;

  const sections = [
    importsOf(parts, reads).join(''),
    route.prelude,
    `@Controller({\n${declarationOf(parts)
      .map((entry) => `  ${entry},\n`)
      .join(
        '',
      )}})\nexport class ${route.pascal}Controller {\n  constructor(private readonly ${route.bus}: ${route.busType}) {}\n\n  ${signature} {\n${body}\n  }\n}`,
    route.trailer,
  ];

  return `${sections
    .filter((section) => section.trim() !== '')
    .map((section) => section.trimEnd())
    .join('\n\n')}\n`;
}

function declarationOf(parts: ControllerParts): string[] {
  const { route, types, group } = parts;
  const { spec } = route;
  const path = unquoted(spec.get('path') ?? "'/'");
  const rest = group === undefined ? path : path.slice(group.prefix.length);
  const derived = `'${route.pascal.charAt(0).toLowerCase()}${route.pascal.slice(1)}'`;
  const kept = (key: string): string[] => (spec.has(key) ? [`${key}: ${spec.get(key) ?? ''}`] : []);

  return [
    ...(group === undefined ? [...kept('tags'), 'guards: [Public]'] : [`group: ${group.className}`]),
    `method: ${spec.get('method') ?? "'GET'"}`,
    `path: '${rest === '' ? '/' : rest}'`,
    ...(spec.get('operationId') === derived ? [] : kept('operationId')),
    ...kept('summary'),
    ...kept('description'),
    ...(group === undefined || sameList(spec.get('tags'), group.tags) ? [] : kept('tags')),
    ...types.parts,
    types.response,
    `errors: [${errorsOf(parts).join(', ')}]`,
    ...kept('deprecated'),
  ];
}

/** What the guard and the group already say is not repeated on the controller. */
function errorsOf({ route, group }: ControllerParts): string[] {
  const said = group === undefined ? [] : [...GUARD_ERRORS, ...group.errors.map((code) => `'${code}'`)];

  return listed(route.spec.get('errors')).filter((code) => !said.includes(code));
}

function importsOf({ route, types, group, groupImport }: ControllerParts, reads: boolean): string[] {
  const http = [
    'Controller',
    ...(group === undefined ? ['Public'] : []),
    ...(reads ? ['type HttpRequest'] : []),
    ...(types.usesPageBody ? ['type PageBody'] : []),
  ];

  const kept = route.imports
    .filter((statement) => !fromAuth(statement) || namesOf(statement).some((name) => name !== 'actorOf'))
    .map((statement) => (statement.includes("from '@ddd-ts-kit/http'") ? withNames(statement, http) : statement))
    .map((statement) => (fromAuth(statement) ? without(statement, 'actorOf') : statement));

  const infer = types.usesInfer && !kept.some((statement) => /\bInfer\b/.test(statement));

  return [
    ...kept,
    ...(infer ? ["import type { Infer } from '@ddd-ts-kit/validation';\n"] : []),
    ...(group === undefined ? [] : [`${groupImport}\n`]),
  ];
}

function fromAuth(statement: string): boolean {
  return statement.includes("from '@ddd-ts-kit/auth'");
}

/** The import of `@ddd-ts-kit/http` without what a function route needed, with what a controller needs. */
function withNames(statement: string, added: readonly string[]): string {
  const names = namesOf(statement).filter((name) => name !== 'defineRoute' && name !== 'type Route');

  const all = [
    ...new Set([
      ...added.filter((name) => !name.startsWith('type ')),
      ...names,
      ...added.filter((name) => name.startsWith('type ')),
    ]),
  ];

  return `import { ${all.join(', ')} } from '@ddd-ts-kit/http';\n`;
}

function without(statement: string, name: string): string {
  const specifier = /from '([^']+)'/.exec(statement)?.[1] ?? '';

  return `import { ${namesOf(statement)
    .filter((kept) => kept !== name)
    .join(', ')} } from '${specifier}';\n`;
}

function namesOf(statement: string): string[] {
  return (/\{([\s\S]*)\}/.exec(statement)?.[1] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

function listed(list: string | undefined): string[] {
  return (list ?? '[]')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function sameList(written: string | undefined, tags: readonly string[]): boolean {
  return listed(written).map(unquoted).join(',') === tags.join(',');
}

function unquoted(text: string): string {
  return text.replace(/^['"]|['"]$/g, '');
}
