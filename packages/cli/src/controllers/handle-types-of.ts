import { entriesOf } from './entries-of';
import type { FunctionRoute } from './function-route';

const PARTS = ['params', 'query', 'headers', 'body'];

/** What `handle` receives and returns, named from the schemas of the route. */
export interface HandleTypes {
  /** The entries of the declaration for the parts of the request, as written. */
  readonly parts: readonly string[];
  readonly request: string;
  readonly result: string;
  /** The entry `response: { .. }` of the declaration. */
  readonly response: string;
  readonly usesInfer: boolean;
  readonly usesPageBody: boolean;
}

/** Reads the request and the one response of a route; a string says why it cannot be a controller. */
export function handleTypesOf(route: FunctionRoute): HandleTypes | string {
  const request = entriesOf(route.spec.get('request') ?? '{}');
  const responses = [...entriesOf(route.spec.get('responses') ?? '{}')];
  const [[status, written] = []] = responses;

  if (responses.length !== 1 || status === undefined || written === undefined) {
    return 'it declares several responses, and a controller answers one: keep it a function';
  }

  const response = entriesOf(written);
  const body = response.get('body');
  const declared = PARTS.filter((part) => request.has(part)).map((part) => [part, request.get(part) ?? part] as const);
  const typed = declared.map(([part, schema]) => `${part}: ${typeOf(route, schema)}`);
  const result = body === undefined ? 'void' : typeOf(route, body);

  return {
    parts: declared.map(([part, schema]) => entryOf(part, schema)),
    request: typed.length === 0 ? 'HttpRequest' : `HttpRequest<{ ${typed.join('; ')} }>`,
    result,
    response: responseEntry(status, response),
    usesInfer: [...typed, result].some((type) => type.includes('Infer<')),
    usesPageBody: result.startsWith('PageBody<'),
  };
}

function responseEntry(status: string, response: ReadonlyMap<string, string>): string {
  const fields = [
    `status: ${status}`,
    ...['description', 'body'].flatMap((key) => (response.has(key) ? [`${key}: ${response.get(key) ?? ''}`] : [])),
  ];

  return `response: { ${fields.join(', ')} }`;
}

function entryOf(key: string, value: string): string {
  return key === value ? key : `${key}: ${value}`;
}

/** The class a schema is built from, when the route says it; the output of the schema otherwise. */
function typeOf(route: FunctionRoute, schema: string): string {
  const page = /^pageSchemaOf\((.+)\)$/.exec(schema)?.[1];

  if (page !== undefined) {
    return `PageBody<${typeOf(route, page)}>`;
  }

  const built =
    /^classSchema\((\w+)/.exec(schema) ??
    new RegExp(String.raw`\bconst ${schema} = classSchema\((\w+)`).exec(route.prelude);

  if (built?.[1] !== undefined) {
    return built[1];
  }

  return /^\w+$/.test(schema) ? `Infer<typeof ${schema}>` : 'unknown';
}
