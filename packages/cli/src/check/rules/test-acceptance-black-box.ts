import type { Finding } from '../model/finding';
import type { Location } from '../model/location';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { besideTheSources } from '../project/beside-the-sources';
import { inContext } from '../support/in-context';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

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
    if (target.kind !== 'file' || !target.path.startsWith(sourceRoot) || isPublic(target.location)) {
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

/** What a client of a context may know of it: the test data of its builders, wherever its modules keep them, and its published language. */
function isPublic(location: Location): boolean {
  return (
    inContext(location) &&
    (location.layer === 'published-language' || (location.layer === 'test' && location.inside[0] === 'builders'))
  );
}
