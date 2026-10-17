import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { besideTheSources } from '../project/beside-the-sources.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

const ACCEPTANCE_SPEC = /^test\/acceptance\/[^/]+\.acceptance\.spec\.ts$/;

export const testAcceptanceBlackBox: Rule = {
  id: 'test/acceptance-black-box',
  description:
    'An acceptance spec of `test/acceptance/` drives the application as a client does: it imports nothing from the source root but the builders of a context and its published language.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return besideTheSources(project)
      .filter((file) => ACCEPTANCE_SPEC.test(file.path))
      .flatMap((file) => toViolations(report, file.path, findingsIn(project, file)));
  },
};

function findingsIn({ config }: Project, file: SourceFile): Finding[] {
  const sourceRoot = `${config.sourceRoot}/`;

  return file.imports.flatMap(({ specifier, line, target }) => {
    if (target.kind !== 'file' || !target.path.startsWith(sourceRoot) || isPublic(target.path, config.contextsDir)) {
      return [];
    }

    return [
      {
        line,
        message: `The acceptance spec imports "${specifier}", a file of the application.`,
        fix: 'Drive the application through its routes and assert what a client observes (the answer, the problem document, the integration events); arrange through the API too, with the builders of the context for the data. A scenario written before its code cannot import a class that does not exist yet, and one that does is no longer a client of the application.',
      },
    ];
  });
}

/** What a client of a context may know of it: the test data of its builders and its published language. */
function isPublic(path: string, contextsDir: string): boolean {
  const [context, top, folder] = path.slice(contextsDir.length + 1).split('/');

  return (
    path.startsWith(`${contextsDir}/`) &&
    context !== undefined &&
    (top === 'published-language' || (top === 'test' && folder === 'builders'))
  );
}
