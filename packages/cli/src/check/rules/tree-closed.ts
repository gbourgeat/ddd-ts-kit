import type { Rule } from '../model/rule';
import { strayEntry } from '../canonical/stray-entry';
import { reporter } from '../support/reporter';

export const treeClosed: Rule = {
  id: 'tree/closed',
  description:
    'A context holds only the canonical directories (plus its declared extraDirectories), and no source file outside a role directory.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    // A rejected directory is reported once: what it holds is not reported again.
    const rejected: string[] = [];

    return project.contextEntries.flatMap((entry) => {
      if (rejected.some((parent) => entry.startsWith(parent))) {
        return [];
      }

      const flaw = strayEntry(entry, project.config);

      if (flaw === undefined) {
        return [];
      }

      if (entry.endsWith('/')) {
        rejected.push(entry);
      }

      return [report({ file: entry.replace(/\/$/, ''), line: 1 }, flaw.message, flaw.fix)];
    });
  },
};
