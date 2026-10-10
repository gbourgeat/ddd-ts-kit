import type { Config } from '../config/index.js';
import { describeContext } from '../describe/describe-context.js';
import { referenceLines } from '../describe/reference-lines.js';
import { replaceRegion } from '../markers/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ContextFacts } from './context-facts.js';
import { ensureReferenceRegion } from './ensure-reference-region.js';
import { readContext } from './read-context.js';

/** The regions a CONTEXT.md written before the kit knew them may lack without being told: they are refreshed when present. */
const LATER_REGIONS = ['jobs'];

/**
 * Rewrites the generated lists of a CONTEXT.md (aggregates, published events, permissions,
 * scheduled jobs, relationships) and its reference (use cases, routes, events, ports, policies,
 * gateways) from what is on disk and in the config. The generator and
 * `docs` both go through here, so `docs --check` is clean right after a `generate`.
 */
export function refreshContextDoc(ws: Workspace, config: Config, context: string): void {
  const file = `${config.contextsDir}/${context}/CONTEXT.md`;
  const original = ws.read(file);

  if (original === undefined) return;

  const facts = readContext(ws, config, context);
  let content = original;

  for (const [region, lines] of Object.entries(generatedLists(facts))) {
    const next = replaceRegion(content, region, lines);

    if (next !== undefined) content = next;
    else if (!LATER_REGIONS.includes(region) || facts.jobs.length > 0) ws.note(`${file} has no "ddd-ts-kit:${region}" region: its generated list is not kept up to date.`);
  }

  ws.update(file, replaceRegion(ensureReferenceRegion(content), 'reference', referenceLines(describeContext(ws, config, facts))) ?? content);
}

function generatedLists(facts: ContextFacts): Record<string, string[]> {
  return {
    aggregates: facts.aggregates.map((name) => `- \`${name}\``),
    events: facts.publishedEvents.map((event) => `- \`${event.type}\` (version ${event.version})`),
    permissions: facts.permissions.length > 0 ? facts.permissions.map((name) => `- \`${facts.name}:${name}\``) : ['No permission declared.'],
    jobs: jobLines(facts),
    relationships: relationshipLines(facts),
  };
}

function jobLines(facts: ContextFacts): string[] {
  if (facts.jobs.length === 0) return ['No scheduled job.'];

  return ['| Job | Schedule | Command |', '|---|---|---|', ...facts.jobs.map((job) => `| \`${job.name}\` | \`${job.schedule}\` | \`${job.command}\` |`)];
}

function relationshipLines(facts: ContextFacts): string[] {
  const lines = [
    ...facts.upstreams.map((upstream) => `- Downstream of \`${upstream.context}\` (${upstream.relationship}).`),
    ...facts.downstreams.map((downstream) => `- Upstream of \`${downstream.context}\` (${downstream.relationship}).`),
  ];

  return lines.length > 0 ? lines : ['No relationship declared.'];
}
