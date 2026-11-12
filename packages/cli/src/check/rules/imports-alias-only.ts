import fs from 'node:fs';
import path from 'node:path';
import { aliasRoots, neighbourSuffix, specifierSuffix, toAlias, type AliasRoot } from '../../alias';
import { CONFIG_FILE } from '../../config';
import type { Finding } from '../model/finding';
import type { Flaw } from '../model/flaw';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { besideTheSources } from '../project/beside-the-sources';
import { perFile } from '../support/per-file';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

const RELATIVE = /^\.{1,2}(?:\/|$)/;
const DOT_SEGMENT = /\/\.{1,2}(?:\/|$)/;
/**
 * A test runner loads its global setup, and what that file imports, from the sources and before
 * any alias of the project exists: the files directly under `test/support/` import one another by
 * a relative path of that same directory, `./<name>`, and nothing else is spared: not the
 * directory itself (`./.`), its parent (`./..`), nor a directory of it. The path names the file
 * the runner finds: the source, with its `.ts` where an import carries an extension. What is on
 * disk says which file that is.
 */
const SUPPORT = 'test/support';
const LOADED_BY_A_RUNNER = /^test\/support\/[^/]+$/;
const NEIGHBOUR = /^\.\/(?!\.{1,2}$)[^/]+$/;
/** The extensions a module of the project or the file emitted for it can bear. */
const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;
/** The source the compiler emits a JavaScript file from, by their extensions. */
const SOURCE_OF: Readonly<Record<string, string>> = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts' };

export const importsAliasOnly: Rule = {
  id: 'imports/alias-only',
  description:
    'A file of the project is imported by its alias (`@/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment. Holds under the source root, `test/` and `scripts/`; the files directly under `test/support/`, which a test runner loads before any alias exists, import one another by `./<name>`, ending with `.ts` under `js`.',
  scope: 'file',
  run(project) {
    const written = writtenBy(project);

    return perFile(project, this.id, (file) => findingsIn(written, file));
  },
  acrossProject(project) {
    const written = writtenBy(project);
    const report = reporter(project, this.id);

    return besideTheSources(project).flatMap((file) => toViolations(report, file.path, findingsIn(written, file)));
  },
};

/** How the project writes an import: the aliases of its trees, what a specifier ends with, and where its files are. */
interface Written {
  readonly root: string;
  readonly roots: readonly AliasRoot[];
  readonly suffix: string;
  /** What the path of a file of `test/support/` to its neighbour ends with. */
  readonly neighbourSuffix: string;
}

function writtenBy({ root, config }: Project): Written {
  return {
    root,
    roots: aliasRoots(config),
    suffix: specifierSuffix(config.importExtension),
    neighbourSuffix: neighbourSuffix(config.importExtension),
  };
}

function findingsIn(written: Written, file: SourceFile): Finding[] {
  return file.imports.flatMap(({ specifier, line }) => {
    const flaw = flawOf(written, file.path, specifier);

    return flaw === undefined ? [] : [{ line, ...flaw }];
  });
}

function flawOf(written: Written, file: string, specifier: string): Flaw | undefined {
  const { roots } = written;

  if (LOADED_BY_A_RUNNER.test(file) && NEIGHBOUR.test(specifier)) {
    return namesADirectory(written, specifier)
      ? directoryFlaw(written, file, specifier)
      : neighbourFlaw(written, specifier);
  }

  if (RELATIVE.test(specifier)) {
    return relativeFlaw(written, specifier, path.posix.join(path.posix.dirname(file), specifier));
  }

  const named = roots.find(({ prefix }) => specifier.startsWith(prefix));

  if (named === undefined || !DOT_SEGMENT.test(`/${specifier.slice(named.prefix.length)}`)) {
    return undefined;
  }

  return {
    message: `The alias import "${specifier}" holds a "." or ".." segment: it can leave ${named.directory}/.`,
    fix: `Write the path of the file from ${named.directory}/ after "${named.prefix}", with no "." or ".." segment: an alias names one file of its directory, and the build rewrites it as such.`,
  };
}

/** `./parts` where test/support/parts/ is a directory and no parts.ts stands beside it: an index, not a neighbour file. */
function namesADirectory({ root }: Written, specifier: string): boolean {
  const named = path.join(root, SUPPORT, specifier);

  return !isFile(`${named}.ts`) && fs.statSync(named, { throwIfNoEntry: false })?.isDirectory() === true;
}

/** What the runner finds on disk is judged, whatever the compiler would accept: a neighbour named as it should be, or left to the compiler, is no flaw. */
function neighbourFlaw(written: Written, specifier: string): Flaw | undefined {
  const expected = neighbourName(written, specifier);

  if (expected === undefined) {
    return undefined;
  }

  if (written.neighbourSuffix === '') {
    return {
      message: `"${specifier}" ends with "${EXTENSION.exec(specifier)?.[0] ?? ''}" although "importExtension" is "none" in ${CONFIG_FILE}.`,
      fix: `Write '${expected}' (\`eslint --fix\` rewrites it): a file of ${SUPPORT}/ names its neighbour as every import of the project names a file, without its extension.`,
    };
  }

  return {
    message: `"${specifier}" does not name its neighbour of ${SUPPORT}/ by the name of its source.`,
    fix: `Write '${expected}' (\`eslint --fix\` rewrites it): a test runner loads its global setup, and what that file imports, from the sources and before any alias exists, where the file is "${expected.slice(2)}". The name of the file the compiler would emit passes the type check, then stops the run on a module that cannot be found.`,
  };
}

/**
 * The name a neighbour is to be imported by, when it is imported by another one. Under `none`, the
 * source `<name>.ts` without its extension. Otherwise the source that exists: `<name>.ts` for
 * `<name>` and `<name>.js`, `<name>.mts` for `<name>.mjs`, `<name>.cts` for `<name>.cjs`. A file
 * that exists as it is named (a source, a JSON file, a JavaScript file) is left alone, and so is a
 * name no source answers, which the compiler reports.
 */
function neighbourName({ root, neighbourSuffix: suffix }: Written, specifier: string): string | undefined {
  const extension = EXTENSION.exec(specifier)?.[0] ?? '';
  const bare = specifier.slice(0, specifier.length - extension.length);
  const exists = (name: string): boolean => isFile(path.join(root, SUPPORT, name));
  const source = `${bare}${SOURCE_OF[extension] ?? '.ts'}`;

  if (suffix === '') {
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

/** A directory is no neighbour: its index is a file of another directory, named by its alias, which names the index file where an import carries an extension. */
function directoryFlaw(written: Written, file: string, specifier: string): Flaw {
  const index = written.suffix === '' ? specifier : `${specifier}/index`;

  return relativeFlaw(written, specifier, path.posix.join(path.posix.dirname(file), index));
}

/** `target` is the file the specifier names, from the project root. */
function relativeFlaw({ roots, suffix }: Written, specifier: string, target: string): Flaw {
  const alias = toAlias(roots, target, suffix);

  if (alias !== undefined) {
    return {
      message: `"${specifier}" is a relative import.`,
      fix: `Import the file by its alias, '${alias}' (\`eslint --fix\` rewrites it): the alias names the file from the root of the project, so the import reads the same from anywhere and survives a move of this file.`,
    };
  }

  const directories = roots.map(({ directory }) => `${directory}/`).join(', ');

  return {
    message: `"${specifier}" is a relative import of a file no alias names.`,
    fix: `Keep what the code imports under ${directories}; a file elsewhere (a manifest, a build product) is read at run time, not imported.`,
  };
}
