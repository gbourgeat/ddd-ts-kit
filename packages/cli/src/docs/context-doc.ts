import type { Config } from '../config.js';
import { replaceRegion } from '../markers.js';
import type { Workspace } from '../workspace.js';
import { readContext, type ContextFacts } from './model.js';

/**
 * Rewrites the generated lists of a CONTEXT.md (aggregates, published events, relationships)
 * from what is on disk and in the config. The generator and `docs` both go through here, so
 * `docs --check` is clean right after a `generate`.
 */
export function refreshContextDoc(ws: Workspace, config: Config, context: string): void {
  const file = `${config.contextsDir}/${context}/CONTEXT.md`;
  const original = ws.read(file);
  if (original === undefined) return;
  const facts = readContext(ws, config, context);
  let content = original;
  for (const [region, lines] of Object.entries(generatedLists(facts))) {
    const next = replaceRegion(content, region, lines);
    if (next === undefined) ws.note(`${file} has no "ddd-ts-kit:${region}" region: its generated list is not kept up to date.`);
    else content = next;
  }
  ws.update(file, content);
}

function generatedLists(facts: ContextFacts): Record<string, string[]> {
  return {
    aggregates: facts.aggregates.map((name) => `- \`${name}\``),
    events: facts.publishedEvents.map((event) => `- \`${event.type}\` (version ${event.version})`),
    relationships: relationshipLines(facts),
    permissions: facts.permissions.length > 0 ? facts.permissions.map((name) => `- \`${facts.name}:${name}\``) : ['No permission declared.'],
  };
}

function relationshipLines(facts: ContextFacts): string[] {
  const lines = [
    ...facts.upstreams.map((upstream) => `- Downstream of \`${upstream.context}\` (${upstream.relationship}).`),
    ...facts.downstreams.map((downstream) => `- Upstream of \`${downstream.context}\` (${downstream.relationship}).`),
  ];
  return lines.length > 0 ? lines : ['No relationship declared.'];
}
