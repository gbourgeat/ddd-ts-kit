import type { Rule, Violation } from '../types.js';
import { inLayer, reporter } from './helpers.js';

export const layerPresentationNoInfrastructure: Rule = {
  id: 'layer/presentation-no-infrastructure',
  description: 'presentation/ imports application/ (and domain types for mapping), never infrastructure/.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      const here = inLayer(file, 'presentation');
      if (here === undefined) continue;
      for (const { target, line } of file.imports) {
        if (target.kind !== 'file' || target.location.area !== 'context') continue;
        if (target.location.layer !== 'infrastructure' || target.location.context !== here.context) continue;
        violations.push(
          report(
            { file: file.path, line },
            `presentation/ imports infrastructure/ (${target.path}).`,
            `Call a command or query handler of application/ instead; the adapter is bound to its port in ${here.context}.module.ts.`,
          ),
        );
      }
    }
    return violations;
  },
};
