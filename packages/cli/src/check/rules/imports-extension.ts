import { aliasRoots, specifierSuffix } from '../../alias';
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

/** The extensions a module of the project or the file emitted for it can bear. */
const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;
const EMITTED = /\.[cm]?js$/;

export const importsExtension: Rule = {
  id: 'imports/extension',
  description:
    'An import of a file of the project ends as "importExtension" says: with no extension under `none`, with `.js` under `js`. Holds under the source root, `test/` and `scripts/`.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => findingsIn(project, file));
  },
  acrossProject(project) {
    const report = reporter(project, this.id);

    return besideTheSources(project).flatMap((file) => toViolations(report, file.path, findingsIn(project, file)));
  },
};

function findingsIn(project: Project, file: SourceFile): Finding[] {
  const roots = aliasRoots(project.config);
  const judge = specifierSuffix(project.config.importExtension) === '' ? withoutExtension : withExtension;

  return file.imports.flatMap(({ specifier, line }) => {
    const root = roots.find(({ prefix }) => specifier.startsWith(prefix));
    const flaw = root === undefined ? undefined : judge(specifier);

    return flaw === undefined ? [] : [{ line, ...flaw }];
  });
}

function withoutExtension(specifier: string): Flaw | undefined {
  const extension = EXTENSION.exec(specifier)?.[0];

  if (extension !== undefined) {
    return {
      message: `"${specifier}" ends with "${extension}" although "importExtension" is "none" in ${CONFIG_FILE}.`,
      fix: `Write '${specifier.slice(0, -extension.length)}' (\`eslint --fix\` rewrites it): the compiler and every tool that reads the sources resolve the file without its extension, and the build writes the ".js" Node needs into the compiled output.`,
    };
  }

  return undefined;
}

function withExtension(specifier: string): Flaw | undefined {
  if (EMITTED.test(specifier)) {
    return undefined;
  }

  const bare = specifier.replace(EXTENSION, '');

  return {
    message: `"${specifier}" does not end with ".js" although "importExtension" is "js" in ${CONFIG_FILE}.`,
    fix: `Write '${bare}.js' (\`eslint --fix\` rewrites it), the name of the file the compiler emits: the compiler resolves as Node does and refuses any other spelling. To drop the extension everywhere instead, set "importExtension" to "none", regenerate tsconfig.json as \`imports/alias-declared\` says and run \`eslint --fix\`.`,
  };
}
