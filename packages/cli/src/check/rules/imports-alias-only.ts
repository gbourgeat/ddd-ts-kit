import path from 'node:path';
import { aliasRoots, specifierSuffix, toAlias, type AliasRoot } from '../../alias';
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

export const importsAliasOnly: Rule = {
  id: 'imports/alias-only',
  description:
    'A file of the project is imported by its alias (`@/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment. Holds under the source root, `test/` and `scripts/`.',
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

/** How the project writes an import: the aliases of its trees and what a specifier ends with. */
interface Written {
  readonly roots: readonly AliasRoot[];
  readonly suffix: string;
}

function writtenBy({ config }: Project): Written {
  return { roots: aliasRoots(config), suffix: specifierSuffix(config.importExtension) };
}

function findingsIn(written: Written, file: SourceFile): Finding[] {
  return file.imports.flatMap(({ specifier, line }) => {
    const flaw = flawOf(written, file.path, specifier);

    return flaw === undefined ? [] : [{ line, ...flaw }];
  });
}

function flawOf(written: Written, file: string, specifier: string): Flaw | undefined {
  const { roots } = written;

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
