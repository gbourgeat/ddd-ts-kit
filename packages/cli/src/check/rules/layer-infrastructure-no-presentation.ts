import type { Rule, Violation } from '../types.js';
import { inLayer, reporter } from './helpers.js';

export const layerInfrastructureNoPresentation: Rule = {
  id: 'layer/infrastructure-no-presentation',
  description: 'infrastructure/ implements ports of application/ and domain/, never imports presentation/.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      const here = inLayer(file, 'infrastructure');
      if (here === undefined) continue;
      for (const { target, line } of file.imports) {
        if (target.kind !== 'file' || target.location.area !== 'context') continue;
        if (target.location.layer !== 'presentation' || target.location.context !== here.context) continue;
        violations.push(
          report(
            { file: file.path, line },
            `infrastructure/ imports presentation/ (${target.path}).`,
            'Move the shared type to application/ (a port or a use case result) and let both sides import it from there.',
          ),
        );
      }
    }
    return violations;
  },
};
