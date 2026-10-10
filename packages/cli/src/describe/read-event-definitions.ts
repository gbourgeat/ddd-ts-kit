import type { Workspace } from '../workspace/index.js';

/** One `defineIntegrationEvent` of a published language. */
export interface EventDefinition {
  /** The exported constant: `invoiceIssuedV2`. */
  readonly name: string;
  readonly type: string;
  readonly version: number;
}

const DEFINITION = /\bexport const (\w+) = defineIntegrationEvent\(\{\s*type:\s*'([^']+)',\s*version:\s*(\d+)/g;

/** The integration events the published language of a context declares. */
export function readEventDefinitions(ws: Workspace, directory: string): EventDefinition[] {
  const folder = `${directory}/published-language`;

  return ws.list(folder).flatMap((file) => [...(ws.read(`${folder}/${file}`) ?? '').matchAll(DEFINITION)].map((match) => ({ name: match[1] ?? '', type: match[2] ?? '', version: Number(match[3]) })));
}
