import type { Rule, Violation } from '../types.js';
import { describeTarget, inLayer, reporter } from './helpers.js';

export const contextPublishedLanguageIsAContract: Rule = {
  id: 'context/published-language-is-a-contract',
  description: 'published-language/ imports only the kernel, the event declaration helper with the schema library of the project, and other published languages.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const allowed = project.config.publishedLanguageAllowedPackages;
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (inLayer(file, 'published-language') === undefined) continue;
      for (const { target, line } of file.imports) {
        if (target.kind === 'package' && allowed.includes(target.name)) continue;
        if (target.kind === 'file' && target.location.area === 'context' && target.location.layer === 'published-language') {
          continue;
        }
        violations.push(
          report(
            { file: file.path, line },
            `The published language imports ${describeTarget(target)}.`,
            'Declare the contract with plain serializable types written in this folder: copy the few fields other contexts need instead of exposing an internal model.',
          ),
        );
      }
    }
    return violations;
  },
};
