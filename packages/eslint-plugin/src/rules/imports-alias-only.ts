import path from 'node:path';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { aliasRoots } from '../project/alias-roots';
import { isJudged } from '../project/is-judged';
import type { AliasRoot } from '../project/alias-root';
import type { LintedFile } from '../project/linted-file';
import { specifierSuffix } from '../project/specifier-suffix';
import { toAlias } from '../project/to-alias';
import { importListener } from '../support/imports/import-listener';
import { defineRule } from '../support/rule/define-rule';

type MessageId = 'relative' | 'unnamed' | 'segment';

const RELATIVE = /^\.{1,2}(?:\/|$)/;
const DOT_SEGMENT = /\/\.{1,2}(?:\/|$)/;
/**
 * A test runner loads its global setup, and what that file imports, with the resolution of Node,
 * before any alias of the project exists: the files of `test/support/` import one another by a
 * relative path of that same directory, `./<name>`, and nothing else is spared.
 */
const LOADED_BY_A_RUNNER = /^test\/support\/[^/]+$/;
const SIBLING = /^\.\/[^/]+$/;

export const importsAliasOnly = defineRule<MessageId>({
  id: 'imports/alias-only',
  type: 'suggestion',
  recommended: 'error',
  fixable: 'code',
  description:
    'A file of the project is imported by its alias (`@/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment. The files of `test/support/`, which a test runner loads before any alias exists, import one another by `./<name>`.',
  messages: {
    relative:
      '"{{specifier}}" is a relative import. Import the file by its alias, \'{{alias}}\': the alias names the file from the root of the project, so the import reads the same from anywhere and survives a move of this file.',
    unnamed:
      '"{{specifier}}" is a relative import of a file no alias names. Keep what the code imports under {{directories}}; a file elsewhere (a manifest, a build product) is read at run time, not imported.',
    segment:
      'The alias import "{{specifier}}" holds a "." or ".." segment: it can leave {{directory}}/. Write the path of the file from {{directory}}/ after "{{prefix}}", with no "." or ".." segment: an alias names one file of its directory, and the build rewrites it as such.',
  },
  create({ file, report }) {
    const roots = aliasRoots(file.config);

    if (!isJudged(roots, file)) {
      return {};
    }

    return importListener(file, ({ node, specifier }) => {
      const finding = judged(roots, file, specifier);

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

function judged(roots: readonly AliasRoot[], file: LintedFile, specifier: string): Found | undefined {
  if (LOADED_BY_A_RUNNER.test(file.path) && SIBLING.test(specifier)) {
    return undefined;
  }

  return RELATIVE.test(specifier) ? relative(file, specifier) : dotSegment(roots, specifier);
}

function relative(file: LintedFile, specifier: string): Found {
  const roots = aliasRoots(file.config);
  const suffix = specifierSuffix(file.config.importExtension);
  const alias = toAlias(roots, path.posix.join(path.posix.dirname(file.path), specifier), suffix);

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
