import fs from 'node:fs';
import path from 'node:path';
import { aliasRoots, FIXED_ALIAS_ROOTS, toAlias, type AliasRoot } from '../../alias/index.js';
import type { Finding } from '../model/finding.js';
import type { Flaw } from '../model/flaw.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { isSource } from '../project/is-source.js';
import { loadSourceFile } from '../project/load-source-file.js';
import { walkDirectory } from '../project/walk-directory.js';
import { perFile } from '../support/per-file.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

const RELATIVE = /^\.{1,2}(?:\/|$)/;
const DOT_SEGMENT = /\/\.{1,2}(?:\/|$)/;
/** The trees `check` does not walk for the other rules: their files are read for their imports only. */
const BESIDE_THE_SOURCES = [FIXED_ALIAS_ROOTS.test.directory, FIXED_ALIAS_ROOTS.scripts.directory];

export const importsAliasOnly: Rule = {
  id: 'imports/alias-only',
  description:
    'A file of the project is imported by its alias (`@/...`), never by a relative path, the same directory included; an alias path holds no `.` or `..` segment. Holds under the source root, `test/` and `scripts/`.',
  scope: 'file',
  run(project) {
    const roots = aliasRoots(project.config);

    return perFile(project, this.id, (file) => findingsIn(roots, file));
  },
  acrossProject(project) {
    const roots = aliasRoots(project.config);
    const report = reporter(project, this.id);

    return besideTheSources(project).flatMap((file) => toViolations(report, file.path, findingsIn(roots, file)));
  },
};

function findingsIn(roots: readonly AliasRoot[], file: SourceFile): Finding[] {
  return file.imports.flatMap(({ specifier, line }) => {
    const flaw = flawOf(roots, file.path, specifier);

    return flaw === undefined ? [] : [{ line, ...flaw }];
  });
}

function flawOf(roots: readonly AliasRoot[], file: string, specifier: string): Flaw | undefined {
  if (RELATIVE.test(specifier)) {
    return relativeFlaw(roots, file, specifier);
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

function relativeFlaw(roots: readonly AliasRoot[], file: string, specifier: string): Flaw {
  const alias = toAlias(roots, path.posix.join(path.posix.dirname(file), specifier));

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

/** The TypeScript sources of the tests and of the scripts, which live next to the source root. */
function besideTheSources(project: Project): SourceFile[] {
  const files: SourceFile[] = [];

  for (const directory of BESIDE_THE_SOURCES) {
    walkDirectory(project.root, directory, (file, isDirectory) => {
      if (!isDirectory && isSource(file)) {
        files.push(loadSourceFile(project.config, file, fs.readFileSync(path.join(project.root, file), 'utf8')));
      }
    });
  }

  return files;
}
