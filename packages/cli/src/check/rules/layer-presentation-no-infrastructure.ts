import type { Rule } from '../model/rule';
import { bindingPlace } from '../support/binding-place';
import { inLayer } from '../support/in-layer';
import { perFile } from '../support/per-file';

export const layerPresentationNoInfrastructure: Rule = {
  id: 'layer/presentation-no-infrastructure',
  description: 'presentation/ imports application/ (and domain types for mapping), never infrastructure/.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const here = inLayer(file, 'presentation');

      if (here === undefined) {
        return [];
      }

      const fix = `Call a command or query handler of application/ instead; the adapter is bound to its port in ${bindingPlace(project, here.context)}.`;

      return file.imports.flatMap(({ target, line }) => {
        if (target.kind !== 'file' || target.location.area !== 'context') {
          return [];
        }

        if (target.location.layer !== 'infrastructure' || target.location.context !== here.context) {
          return [];
        }

        return [{ line, message: `presentation/ imports infrastructure/ (${target.path}).`, fix }];
      });
    });
  },
};
