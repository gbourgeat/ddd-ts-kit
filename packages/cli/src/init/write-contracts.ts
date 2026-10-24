import type { Config } from '../config';
import { stringifyContract } from '../contracts/stringify-contract';
import { stackVars } from '../stack/stack-vars';
import { readTemplate, renderTemplate, type RenderContext } from '../templating';
import type { Workspace } from '../workspace';
import { isRecord } from './is-record';

const INTEGRATION = 'docs/integration';

/** The mark of a contract whose routes or events only the running application knows: the first check of its script writes it. */
const PENDING = 'x-ddd-ts-kit-pending';

const PENDING_TEXT = 'Written by the first `docs:check` or `docs:generate`.';

export interface ContractsRequest {
  readonly config: Config;
  readonly projectName: string;
  readonly presetApplied: boolean;
}

/**
 * The generated contracts of a project that has no route and no integration event of its own
 * yet, as its scripts write them (`docs:generate`), the erasure the platform publishes included
 * with `--privacy on`: the first commit holds them, and the check
 * of the documents passes before anything is generated. A contract that is already there is
 * left alone: the scripts of the project are what keeps it current from then on. When a preset
 * wrote routes and events (`presetApplied`), each is marked to be written by the first check of
 * its script, since only the running application knows them.
 */
export function writeContracts(ws: Workspace, { config, projectName, presetApplied }: ContractsRequest): void {
  const context = { ...stackVars(config), document: documentVars(ws, projectName) };
  const format = config.openapi.format === 'json' ? 'json' : 'yaml';

  const mark = presetApplied ? { [PENDING]: PENDING_TEXT } : {};

  const written = (template: string): string =>
    stringifyContract({ ...asRecord(JSON.parse(renderTemplate(template, context))), ...mark }, format);

  // With the privacy folder, the platform publishes the erasure of a data subject: the contracts list it from the start.
  const events = config.stack.privacy === 'on' ? '.privacy' : '';
  const catalog = readTemplate(`docs/event-catalog${events}.md`);

  const contracts: (readonly [string, string])[] = [
    [`${INTEGRATION}/asyncapi.${format}`, written(`docs/asyncapi${events}.json.tpl`)],
    [`${INTEGRATION}/event-catalog.md`, presetApplied ? `${catalog}\n<!-- ${PENDING}: ${PENDING_TEXT} -->\n` : catalog],
  ];

  // A contract split into documents is written by its script, which knows the route groups.
  if (config.stack.http !== 'none' && config.openapi.documents.length === 0) {
    contracts.push([`openapi/openapi.${format}`, written('docs/openapi.json.tpl')]);
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

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
