import { CONFIG_FILE, type Config } from '../../config/index.js';
import type { Rule } from '../model/rule.js';
import { lineOf } from '../support/line-of.js';
import { reporter } from '../support/reporter.js';

const FIX = 'Decide which context is upstream and remove the opposite upstream entry; the downstream reacts to integration events instead of being imported.';

export const contextNoCycle: Rule = {
  id: 'context/no-cycle',
  description: 'The declared relationships between contexts form no cycle.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return cyclesOf(project.config.contexts).map((cycle) => {
      const [first = ''] = cycle;

      return report({ file: CONFIG_FILE, line: lineOf(project.configText, `"${first}"`) }, `Contexts depend on each other in a cycle: ${[...cycle, first].join(' -> ')}.`, FIX);
    });
  },
};

/** Each cycle of the declared upstreams, once, as the contexts met from its first one. */
function cyclesOf(contexts: Config['contexts']): string[][] {
  const cycles = new Map<string, string[]>();
  const done = new Set<string>();

  const visit = (name: string, trail: readonly string[]): void => {
    const at = trail.indexOf(name);

    if (at !== -1) {
      const cycle = trail.slice(at);
      const key = [...cycle].sort().join('|');

      if (!cycles.has(key)) cycles.set(key, cycle);

      return;
    }

    if (done.has(name)) return;

    for (const upstream of contexts[name]?.upstreams ?? []) visit(upstream.context, [...trail, name]);

    done.add(name);
  };

  for (const name of Object.keys(contexts)) visit(name, []);

  return [...cycles.values()];
}
