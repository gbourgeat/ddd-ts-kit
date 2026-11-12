import fs from 'node:fs';
import path from 'node:path';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { aliasRoots } from '../project/alias-roots';
import { isJudged } from '../project/is-judged';
import type { AliasRoot } from '../project/alias-root';
import type { LintedFile } from '../project/linted-file';
import { neighbourSuffix } from '../project/neighbour-suffix';
import { specifierSuffix } from '../project/specifier-suffix';
import { toAlias } from '../project/to-alias';
import { importListener } from '../support/imports/import-listener';
import { defineRule } from '../support/rule/define-rule';

type MessageId = 'relative' | 'unnamed' | 'segment' | 'neighbourSource' | 'neighbourExtension';

const RELATIVE = /^\.{1,2}(?:\/|$)/;
const DOT_SEGMENT = /\/\.{1,2}(?:\/|$)/;
/**
 * A test runner loads its global setup, and what that file imports, from the sources and before
 * any alias of the project exists: the files directly under `test/support/` import one another by
 * a relative path of that same directory, `./<name>`, and nothing else is spared: not the
 * directory itself (`./.`), its parent (`./..`), nor a directory of it. The path ends as the
 * runner finds the file: with the `.ts` of the source where an import carries an extension.
 */
const LOADED_BY_A_RUNNER = /^test\/support\/[^/]+$/;
const NEIGHBOUR = /^\.\/(?!\.{1,2}$)[^/]+$/;
/** The extensions a module of the project or the file emitted for it can bear. */
const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;
const SOURCE = /\.[cm]?ts$/;

export const importsAliasOnly = defineRule<MessageId>({
  id: 'imports/alias-only',
  type: 'suggestion',
  recommended: 'error',
  fixable: 'code',
  description:
    'A file of the project is imported by its alias (`@/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment. The files directly under `test/support/`, which a test runner loads before any alias exists, import one another by `./<name>`, ending with `.ts` under `js`.',
  messages: {
    relative:
      '"{{specifier}}" is a relative import. Import the file by its alias, \'{{alias}}\': the alias names the file from the root of the project, so the import reads the same from anywhere and survives a move of this file.',
    unnamed:
      '"{{specifier}}" is a relative import of a file no alias names. Keep what the code imports under {{directories}}; a file elsewhere (a manifest, a build product) is read at run time, not imported.',
    neighbourSource:
      '"{{specifier}}" does not name its neighbour of test/support/ by the ".ts" of its source. Write \'{{expected}}\': a test runner loads its global setup, and what that file imports, from the sources and before any alias exists, where the file is "<name>.ts". A ".js" passes the type check, then stops the run on a module that cannot be found.',
    neighbourExtension:
      '"{{specifier}}" ends with "{{extension}}" although "importExtension" is "none". Write \'{{expected}}\': a file of test/support/ names its neighbour as every import of the project names a file, without its extension.',
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
  if (LOADED_BY_A_RUNNER.test(file.path) && NEIGHBOUR.test(specifier) && !namesADirectory(file, specifier)) {
    return neighbour(file, specifier);
  }

  return RELATIVE.test(specifier) ? relative(file, specifier) : dotSegment(roots, specifier);
}

/** `./parts` where test/support/parts/ is a directory and no parts.ts stands beside it, as the disk says when the file is linted. */
function namesADirectory(file: LintedFile, specifier: string): boolean {
  const named = path.join(file.root, path.posix.dirname(file.path), specifier);

  return !fs.existsSync(`${named}.ts`) && fs.statSync(named, { throwIfNoEntry: false })?.isDirectory() === true;
}

/** The ending alone is judged: what the runner finds on disk is the source, whatever the compiler would accept. */
function neighbour(file: LintedFile, specifier: string): Found | undefined {
  const suffix = neighbourSuffix(file.config.importExtension);
  const extension = EXTENSION.exec(specifier)?.[0] ?? '';
  const expected = `${specifier.slice(0, specifier.length - extension.length)}${suffix}`;

  if (suffix === '' ? extension === '' : SOURCE.test(specifier)) {
    return undefined;
  }

  return {
    messageId: suffix === '' ? 'neighbourExtension' : 'neighbourSource',
    data: { specifier, extension, expected },
  };
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
  const rewritten = messageId === 'relative' ? data['alias'] : data['expected'];

  if (rewritten === undefined) {
    return {};
  }

  return { fix: (fixer) => fixer.replaceTextRange([node.range[0] + 1, node.range[1] - 1], rewritten) };
}
