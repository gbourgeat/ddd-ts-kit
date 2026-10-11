import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { aliasRoots } from '../project/alias-roots.js';
import { isJudged } from '../project/is-judged.js';
import { specifierSuffix } from '../project/specifier-suffix.js';
import { importListener } from '../support/imports/import-listener.js';
import { defineRule } from '../support/rule/define-rule.js';

type MessageId = 'unexpected' | 'missing';

/** The extensions a module of the project or the file emitted for it can bear. */
const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;
const EMITTED = /\.[cm]?js$/;

export const importsExtension = defineRule<MessageId>({
  id: 'imports/extension',
  type: 'suggestion',
  recommended: 'error',
  fixable: 'code',
  description:
    'An import of a file of the project ends as "importExtension" says: with no extension under `none`, with `.js` under `js`.',
  messages: {
    unexpected:
      '"{{specifier}}" ends with "{{extension}}" although "importExtension" is "none". Write \'{{expected}}\': the compiler and every tool that reads the sources resolve the file without its extension, and the build writes the ".js" Node needs into the compiled output.',
    missing:
      '"{{specifier}}" does not end with ".js" although "importExtension" is "js". Write \'{{expected}}\', the name of the file the compiler emits: the compiler resolves as Node does and refuses any other spelling.',
  },
  create({ file, report }) {
    const roots = aliasRoots(file.config);
    const suffix = specifierSuffix(file.config.importExtension);

    if (!isJudged(roots, file)) {
      return {};
    }

    return importListener(file, ({ node, specifier }) => {
      const finding = roots.some(({ prefix }) => specifier.startsWith(prefix)) ? judged(specifier, suffix) : undefined;

      if (finding !== undefined) {
        report({ node, ...finding, fix: fixOf(node, finding.data.expected) });
      }
    });
  },
});

interface Found {
  readonly messageId: MessageId;
  readonly data: { readonly specifier: string; readonly extension: string; readonly expected: string };
}

function judged(specifier: string, suffix: string): Found | undefined {
  const extension = EXTENSION.exec(specifier)?.[0] ?? '';
  const expected = `${specifier.slice(0, specifier.length - extension.length)}${suffix}`;

  if (suffix === '') {
    return extension === '' ? undefined : { messageId: 'unexpected', data: { specifier, extension, expected } };
  }

  return EMITTED.test(specifier) ? undefined : { messageId: 'missing', data: { specifier, extension, expected } };
}

/** The specifier rewritten in place, between the quotes it was written with. */
function fixOf(node: TSESTree.Node, expected: string): TSESLint.ReportFixFunction {
  return (fixer) => fixer.replaceTextRange([node.range[0] + 1, node.range[1] - 1], expected);
}
