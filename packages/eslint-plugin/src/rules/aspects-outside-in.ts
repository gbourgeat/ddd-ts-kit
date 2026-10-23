import type { LintedFile } from '../project/linted-file';
import { defineRule } from '../support/rule/define-rule';
import { importListener } from '../support/imports/import-listener';
import { inSourceRoot } from '../support/imports/in-source-root';
import { ASPECTS_PACKAGE } from '../support/outside-concerns/outside-concern';

const DECORATORS = `${ASPECTS_PACKAGE}/decorators`;

export const aspectsOutsideIn = defineRule<'decorators'>({
  id: 'aspects/outside-in',
  type: 'problem',
  recommended: 'error',
  description:
    'The decorator form of an aspect is imported only by an adapter in infrastructure/ or by the platform; everywhere else an aspect is applied at the composition root.',
  messages: {
    decorators: `"${DECORATORS}" is imported in {{place}}: an aspect decorator belongs on an adapter class. Apply the aspect at the composition root instead (\`.with(...)\` on the binding, or the \`decorate\` hook), or move the decorated class to infrastructure/ of its context or to the platform.`,
  },
  create({ file, report }) {
    if (!isJudged(file)) {
      return {};
    }

    return importListener(file, ({ node, specifier }) => {
      if (specifier === DECORATORS || specifier.startsWith(`${DECORATORS}/`)) {
        report({ node, messageId: 'decorators', data: { place: placeOf(file) } });
      }
    });
  },
});

/** domain/ and application/ are left to the layer rules, which refuse every entry of the package: one import, one report. */
function isJudged(file: LintedFile): boolean {
  const { location } = file;

  if (file.isTest || !inSourceRoot(file) || location.area === 'platform') {
    return false;
  }

  return location.area !== 'context' || !['infrastructure', 'domain', 'application'].includes(location.layer);
}

function placeOf({ location, path }: LintedFile): string {
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
