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
 * directory itself (`./.`), its parent (`./..`), nor a directory of it. The path names the file
 * the runner finds: the source, with its `.ts` where an import carries an extension. What is on
 * disk when the file is linted says which file that is.
 */
const LOADED_BY_A_RUNNER = /^test\/support\/[^/]+$/;
const NEIGHBOUR = /^\.\/(?!\.{1,2}$)[^/]+$/;
/** The extensions a module of the project or the file emitted for it can bear. */
const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;
/** The source the compiler emits a JavaScript file from, by their extensions. */
const SOURCE_OF: Readonly<Record<string, string>> = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts' };

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
      '"{{specifier}}" does not name its neighbour of test/support/ by the name of its source. Write \'{{expected}}\': a test runner loads its global setup, and what that file imports, from the sources and before any alias exists, where the file is "{{source}}". The name of the file the compiler would emit passes the type check, then stops the run on a module that cannot be found.',
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
  if (LOADED_BY_A_RUNNER.test(file.path) && NEIGHBOUR.test(specifier)) {
    return namesADirectory(file, specifier) ? directory(file, specifier) : neighbour(file, specifier);
  }

  return RELATIVE.test(specifier) ? relative(file, specifier) : dotSegment(roots, specifier);
}

/** `./parts` where test/support/parts/ is a directory and no parts.ts stands beside it, as the disk says when the file is linted. */
function namesADirectory(file: LintedFile, specifier: string): boolean {
  const named = path.join(file.root, path.posix.dirname(file.path), specifier);

  return !isFile(`${named}.ts`) && fs.statSync(named, { throwIfNoEntry: false })?.isDirectory() === true;
}

/** A directory is no neighbour: its index is a file of another directory, named by its alias, which names the index file where an import carries an extension. */
function directory(file: LintedFile, specifier: string): Found {
  const bare = specifierSuffix(file.config.importExtension) === '';

  return relative(file, specifier, bare ? specifier : `${specifier}/index`);
}

/** What the runner finds on disk is judged, whatever the compiler would accept: a neighbour named as it should be, or left to the compiler, is not reported. */
function neighbour(file: LintedFile, specifier: string): Found | undefined {
  const expected = neighbourName(file, specifier);
  const extension = EXTENSION.exec(specifier)?.[0] ?? '';
  const bare = neighbourSuffix(file.config.importExtension) === '';

  if (expected === undefined) {
    return undefined;
  }

  return {
    messageId: bare ? 'neighbourExtension' : 'neighbourSource',
    data: { specifier, extension, expected, source: expected.slice(2) },
  };
}

/**
 * The name a neighbour is to be imported by, when it is imported by another one. Under `none`, the
 * source `<name>.ts` without its extension. Otherwise the source that exists: `<name>.ts` for
 * `<name>` and `<name>.js`, `<name>.mts` for `<name>.mjs`, `<name>.cts` for `<name>.cjs`. A file
 * that exists as it is named (a source, a JSON file, a JavaScript file) is left alone, and so is a
 * name no source answers, which the compiler reports.
 */
function neighbourName(file: LintedFile, specifier: string): string | undefined {
  const extension = EXTENSION.exec(specifier)?.[0] ?? '';
  const bare = specifier.slice(0, specifier.length - extension.length);
  const exists = (name: string): boolean => isFile(path.join(file.root, path.posix.dirname(file.path), name));
  const source = `${bare}${SOURCE_OF[extension] ?? '.ts'}`;

  if (neighbourSuffix(file.config.importExtension) === '') {
    return namedWithItsExtension(extension, exists(specifier)) && exists(`${bare}.ts`) ? bare : undefined;
  }

  return !exists(specifier) && exists(source) ? source : undefined;
}

/** Under `none`: a source named with its `.ts`, or by the `.js` the compiler would emit, unless a JavaScript file of that name is there. */
function namedWithItsExtension(extension: string, isThere: boolean): boolean {
  return extension === '.ts' || (extension === '.js' && !isThere);
}

function isFile(file: string): boolean {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true;
}

function relative(file: LintedFile, specifier: string, target = specifier): Found {
  const roots = aliasRoots(file.config);
  const suffix = specifierSuffix(file.config.importExtension);
  const alias = toAlias(roots, path.posix.join(path.posix.dirname(file.path), target), suffix);

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
