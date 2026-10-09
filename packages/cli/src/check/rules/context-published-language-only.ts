import type { Rule, Violation } from '../types.js';
import { inContext, reporter } from './helpers.js';

export const contextPublishedLanguageOnly: Rule = {
  id: 'context/published-language-only',
  description: "A file imports from another context only through that context's published-language/.",
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!inContext(file.location)) continue;
      const here = file.location;
      for (const { target, line } of file.imports) {
        if (target.kind !== 'file' || !inContext(target.location)) continue;
        const there = target.location;
        if (there.context === here.context || there.layer === 'published-language') continue;
        violations.push(
          report(
            { file: file.path, line },
            `"${here.context}" imports the internals of "${there.context}" (${target.path}).`,
            `Import from ${project.config.contextsDir}/${there.context}/published-language only; if the type is missing there, publish it with \`ddd-ts-kit generate integration-event ${there.context} <Aggregate> <Fact>\` or react to an integration event.`,
          ),
        );
      }
    }
    return violations;
  },
};
