import path from 'node:path';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { AliasRoot } from '../project/alias-root.js';
import { aliasRoots } from '../project/alias-roots.js';
import type { LintedFile } from '../project/linted-file.js';
import { toAlias } from '../project/to-alias.js';
import { importListener } from '../support/imports/import-listener.js';
import { defineRule } from '../support/rule/define-rule.js';

type MessageId = 'relative' | 'unnamed' | 'segment';

const RELATIVE = /^\.{1,2}(?:\/|$)/;
const DOT_SEGMENT = /\/\.{1,2}(?:\/|$)/;
/** Written by a tool and never linted as project code. */
const BUILD_PRODUCTS = ['generated'];

export const importsAliasOnly = defineRule<MessageId>({
  id: 'imports/alias-only',
  type: 'suggestion',
  recommended: 'error',
  fixable: 'code',
  description:
    'A file of the project is imported by its alias (`#src/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment.',
  messages: {
    relative:
      '"{{specifier}}" is a relative import. Import the file by its alias, \'{{alias}}\': the alias names the file from the root of the project, so the import reads the same from anywhere and survives a move of this file.',
    unnamed:
      '"{{specifier}}" is a relative import of a file no alias names. Keep what the code imports under {{directories}}; a file elsewhere (a manifest, a build product) is read at run time, not imported.',
    segment:
      'The alias import "{{specifier}}" holds a "." or ".." segment: it can leave {{directory}}/. Write the path of the file from {{directory}}/ after "{{prefix}}", with no "." or ".." segment: an alias names one file of its directory, and Node refuses the others.',
  },
  create({ file, report }) {
    const roots = aliasRoots(file.config);

    if (!isJudged(roots, file)) {
      return {};
    }

    return importListener(file, ({ node, specifier }) => {
      const finding = RELATIVE.test(specifier) ? relative(roots, file, specifier) : dotSegment(roots, specifier);

      if (finding !== undefined) {
        report({ node, ...finding, ...fixOf(node, finding) });
      }
    });
  },
});

interface Found {
  readonly messageId: MessageId;
  readonly data: Readonly<Record<string, string>>;
}

/** A source under an aliased tree the team writes: the source root, the tests and the scripts. */
function isJudged(roots: readonly AliasRoot[], file: LintedFile): boolean {
  return roots.some(({ directory }) => !BUILD_PRODUCTS.includes(directory) && file.path.startsWith(`${directory}/`));
}

function relative(roots: readonly AliasRoot[], file: LintedFile, specifier: string): Found {
  const alias = toAlias(roots, path.posix.join(path.posix.dirname(file.path), specifier));

  if (alias !== undefined) {
    return { messageId: 'relative', data: { specifier, alias } };
  }

  return {
    messageId: 'unnamed',
    data: { specifier, directories: roots.map(({ directory }) => `${directory}/`).join(', ') },
  };
}

function dotSegment(roots: readonly AliasRoot[], specifier: string): Found | undefined {
  const named = roots.find(({ prefix }) => specifier.startsWith(prefix));

  if (named === undefined || !DOT_SEGMENT.test(`/${specifier.slice(named.prefix.length)}`)) {
    return undefined;
  }

  return { messageId: 'segment', data: { specifier, directory: named.directory, prefix: named.prefix } };
}

/** The specifier rewritten in place, between the quotes it was written with. */
function fixOf(node: TSESTree.Node, { messageId, data }: Found): { fix?: TSESLint.ReportFixFunction } {
  const alias = data['alias'];

  if (messageId !== 'relative' || alias === undefined) {
    return {};
  }

  return { fix: (fixer) => fixer.replaceTextRange([node.range[0] + 1, node.range[1] - 1], alias) };
}
