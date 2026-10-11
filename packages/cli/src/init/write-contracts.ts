import type { Config } from '../config/index.js';
import { stackVars } from '../stack/stack-vars.js';
import { readTemplate, renderTemplate, type RenderContext } from '../templating/index.js';
import type { Workspace } from '../workspace/index.js';
import { isRecord } from './is-record.js';

const INTEGRATION = 'docs/integration';

/**
 * The generated contracts of a project that has no route and no integration event of its own
 * yet, as its scripts write them (`docs:generate`): the first commit holds them, and the check
 * of the documents passes before anything is generated. A contract that is already there is
 * left alone: the scripts of the project are what keeps it current from then on.
 */
export function writeContracts(ws: Workspace, config: Config, projectName: string): void {
  const context = { ...stackVars(config), document: documentVars(ws, projectName) };

  const contracts: (readonly [string, string])[] = [
    [`${INTEGRATION}/asyncapi.json`, renderTemplate('docs/asyncapi.json.tpl', context)],
    [`${INTEGRATION}/event-catalog.md`, readTemplate('docs/event-catalog.md')],
  ];

  if (config.stack.http !== 'none') {
    contracts.push(['openapi/openapi.json', renderTemplate('docs/openapi.json.tpl', context)]);
  }

  for (const [file, content] of contracts) {
    if (!ws.exists(file)) {
      ws.create(file, content);
    }
  }
}

/** The title and the version the scripts read from package.json, with their fallbacks, as JSON texts. */
function documentVars(ws: Workspace, projectName: string): RenderContext {
  const manifest: unknown = JSON.parse(ws.read('package.json') ?? '{}');
  const field = (name: string): unknown => (isRecord(manifest) ? manifest[name] : undefined);

  const text = (value: unknown, fallback: string): string =>
    JSON.stringify(typeof value === 'string' ? value : fallback);

  return { title: text(field('name'), projectName), version: text(field('version'), '0.0.0') };
}
