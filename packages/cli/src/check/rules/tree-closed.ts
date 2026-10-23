import type { Rule } from '../model/rule';
import { earlierContextFile } from '../canonical/earlier-context-file';
import { strayEntry } from '../canonical/stray-entry';
import { reporter } from '../support/reporter';

export const treeClosed: Rule = {
  id: 'tree/closed',
  description:
    'A context holds only the canonical directories (plus its declared extraDirectories), and no source file outside a role directory; its code list and its permission set sit at its root.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    // A rejected directory is reported once: what it holds is not reported again.
    const rejected: string[] = [];
    const entries = new Set(project.contextEntries);

    return project.contextEntries.flatMap((entry) => {
      if (rejected.some((parent) => entry.startsWith(parent))) {
        return [];
      }

      const earlier = earlierContextFile(entry, project.config, entries);

      if (earlier !== undefined) {
        const violation = report({ file: entry, line: 1 }, earlier.flaw.message, earlier.flaw.fix);

        return [earlier.severity === 'warn' ? { ...violation, severity: earlier.severity } : violation];
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
