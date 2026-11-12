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
 * directory itself (`./.`), its parent (`./..`), nor a directory of it. The path ends as the
 * runner finds the file: with the `.ts` of the source where an import carries an extension.
 */
const SUPPORT = 'test/support';
const LOADED_BY_A_RUNNER = /^test\/support\/[^/]+$/;
const NEIGHBOUR = /^\.\/(?!\.{1,2}$)[^/]+$/;
/** The extensions a module of the project or the file emitted for it can bear. */
const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;
const SOURCE = /\.[cm]?ts$/;

export const importsAliasOnly: Rule = {
  id: 'imports/alias-only',
  description:
    'A file of the project is imported by its alias (`@/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment. Holds under the source root, `test/` and `scripts/`; the files directly under `test/support/`, which a test runner loads before any alias exists, import one another by `./<name>`, ending with `.ts` under `js`.',
  scope: 'file',
  run(project) {
    const written = writtenBy(project, []);

    return perFile(project, this.id, (file) => findingsIn(written, file));
  },
  acrossProject(project) {
    const beside = besideTheSources(project);
    const written = writtenBy(project, beside);
    const report = reporter(project, this.id);

    return beside.flatMap((file) => toViolations(report, file.path, findingsIn(written, file)));
  },
};

/** How the project writes an import: the aliases of its trees, what a specifier ends with, and what `test/support/` holds. */
interface Written {
  readonly roots: readonly AliasRoot[];
  readonly suffix: string;
  /** What the path of a file of `test/support/` to its neighbour ends with. */
  readonly neighbourSuffix: string;
  /** The files under `test/support/`, at any depth. */
  readonly support: readonly string[];
}

function writtenBy({ config }: Project, beside: readonly SourceFile[]): Written {
  return {
    roots: aliasRoots(config),
    suffix: specifierSuffix(config.importExtension),
    neighbourSuffix: neighbourSuffix(config.importExtension),
    support: beside.map((file) => file.path).filter((file) => file.startsWith(`${SUPPORT}/`)),
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

  if (LOADED_BY_A_RUNNER.test(file) && NEIGHBOUR.test(specifier) && !namesADirectory(written, specifier)) {
    return neighbourFlaw(written, specifier);
  }

  if (RELATIVE.test(specifier)) {
    return relativeFlaw(written, file, specifier);
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

/** `./parts` where test/support/parts/ holds files and no parts.ts stands beside it: an index, not a neighbour file. */
function namesADirectory({ support }: Written, specifier: string): boolean {
  const named = `${SUPPORT}/${specifier.slice(2)}`;

  return support.some((file) => file.startsWith(`${named}/`)) && !support.includes(`${named}.ts`);
}

/** The ending alone is judged: what the runner finds on disk is the source, whatever the compiler would accept. */
function neighbourFlaw({ neighbourSuffix: suffix }: Written, specifier: string): Flaw | undefined {
  const extension = EXTENSION.exec(specifier)?.[0] ?? '';
  const expected = `${specifier.slice(0, specifier.length - extension.length)}${suffix}`;

  if (suffix === '' ? extension === '' : SOURCE.test(specifier)) {
    return undefined;
  }

  if (suffix === '') {
    return {
      message: `"${specifier}" ends with "${extension}" although "importExtension" is "none" in ${CONFIG_FILE}.`,
      fix: `Write '${expected}' (\`eslint --fix\` rewrites it): a file of ${SUPPORT}/ names its neighbour as every import of the project names a file, without its extension.`,
    };
  }

  return {
    message: `"${specifier}" does not name its neighbour of ${SUPPORT}/ by the ".ts" of its source.`,
    fix: `Write '${expected}' (\`eslint --fix\` rewrites it): a test runner loads its global setup, and what that file imports, from the sources and before any alias exists, where the file is "<name>.ts". A ".js" passes the type check, then stops the run on a module that cannot be found.`,
  };
}

function relativeFlaw({ roots, suffix }: Written, file: string, specifier: string): Flaw {
  const alias = toAlias(roots, path.posix.join(path.posix.dirname(file), specifier), suffix);

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
