import { CONFIG_FILE } from '../../config.js';
import type { Rule, Violation } from '../types.js';
import { lineOf, reporter } from './helpers.js';

export const contextNoCycle: Rule = {
  id: 'context/no-cycle',
  description: 'The declared relationships between contexts form no cycle.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    const { contexts } = project.config;
    const violations: Violation[] = [];
    const reported = new Set<string>();
    const done = new Set<string>();

    const visit = (name: string, trail: readonly string[]): void => {
      const at = trail.indexOf(name);
      if (at !== -1) {
        const cycle = trail.slice(at);
        const key = [...cycle].sort().join('|');
        if (reported.has(key)) return;
        reported.add(key);
        const first = cycle[0] ?? name;
        violations.push(
          report(
            { file: CONFIG_FILE, line: lineOf(project.configText, `"${first}"`) },
            `Contexts depend on each other in a cycle: ${[...cycle, name].join(' -> ')}.`,
            'Decide which context is upstream and remove the opposite upstream entry; the downstream reacts to integration events instead of being imported.',
          ),
        );
        return;
      }
      if (done.has(name)) return;
      for (const upstream of contexts[name]?.upstreams ?? []) visit(upstream.context, [...trail, name]);
      done.add(name);
    };

    for (const name of Object.keys(contexts)) visit(name, []);
    return violations;
  },
};
