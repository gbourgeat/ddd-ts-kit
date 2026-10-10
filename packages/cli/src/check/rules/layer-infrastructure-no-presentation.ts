import type { Rule } from '../model/rule.js';
import { inLayer } from '../support/in-layer.js';
import { perFile } from '../support/per-file.js';

const FIX = 'Move the shared type to application/ (a port or a use case result) and let both sides import it from there.';

export const layerInfrastructureNoPresentation: Rule = {
  id: 'layer/infrastructure-no-presentation',
  description: 'infrastructure/ implements ports of application/ and domain/, never imports presentation/.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const here = inLayer(file, 'infrastructure');

      if (here === undefined) return [];

      return file.imports.flatMap(({ target, line }) => {
        if (target.kind !== 'file' || target.location.area !== 'context') return [];
        if (target.location.layer !== 'presentation' || target.location.context !== here.context) return [];

        return [{ line, message: `infrastructure/ imports presentation/ (${target.path}).`, fix: FIX }];
      });
    });
  },
};
