import { ASPECTS_PACKAGE } from '../layers/aspects-package.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const DECORATORS = `${ASPECTS_PACKAGE}/decorators`;

const FIX =
  'Apply the aspect at the composition root instead (`.with(...)` on the binding, or the `decorate` hook), or move the decorated class to infrastructure/ of its context or to the platform.';

export const aspectsOutsideIn: Rule = {
  id: 'aspects/outside-in',
  description:
    'The decorator form of an aspect is imported only by an adapter in infrastructure/ or by the platform; everywhere else an aspect is applied at the composition root.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!isJudged(file)) {
        return [];
      }

      return file.imports
        .filter(({ specifier }) => specifier === DECORATORS || specifier.startsWith(`${DECORATORS}/`))
        .map(({ line }) => ({
          line,
          message: `"${DECORATORS}" is imported in ${placeOf(file)}: an aspect decorator belongs on an adapter class.`,
          fix: FIX,
        }));
    });
  },
};

/** domain/ and application/ are left to the layer rules, which refuse every entry of the package: one import, one report. */
function isJudged({ isTest, location }: SourceFile): boolean {
  if (isTest || location.area === 'platform') {
    return false;
  }

  return location.area !== 'context' || !['infrastructure', 'domain', 'application'].includes(location.layer);
}

function placeOf({ location, path }: SourceFile): string {
  if (location.area === 'shared-kernel') {
    return 'the shared kernel';
  }

  if (location.area !== 'context') {
    return path;
  }

  if (location.layer === 'module') {
    return `the module file of "${location.context}"`;
  }

  return location.layer === 'root' ? path : `${location.layer}/`;
}
