import type { ImportTarget } from '../model/import-target';
import type { Rule } from '../model/rule';
import { describeTarget } from '../support/describe-target';
import { inLayer } from '../support/in-layer';
import { perFile } from '../support/per-file';

const FIX =
  'Declare the contract with plain serializable types written in this folder: copy the few fields other contexts need instead of exposing an internal model.';

export const contextPublishedLanguageIsAContract: Rule = {
  id: 'context/published-language-is-a-contract',
  description:
    'published-language/ imports only the kernel, the event declaration helper with the schema library of the project, and other published languages.',
  scope: 'file',
  run(project) {
    const allowed = project.config.publishedLanguageAllowedPackages;

    return perFile(project, this.id, (file) => {
      if (inLayer(file, 'published-language') === undefined) {
        return [];
      }

      return file.imports
        .filter(({ target }) => !isContract(target, allowed))
        .map(({ target, line }) => ({
          line,
          message: `The published language imports ${describeTarget(target)}.`,
          fix: FIX,
        }));
    });
  },
};

function isContract(target: ImportTarget, allowed: readonly string[]): boolean {
  if (target.kind === 'package') {
    return allowed.includes(target.name);
  }

  return target.kind === 'file' && target.location.area === 'context' && target.location.layer === 'published-language';
}
