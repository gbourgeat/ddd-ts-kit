import path from 'node:path';
import { roleOf } from '../canonical/role-of';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inContext } from '../support/in-context';
import { isAbstractBase } from '../support/is-abstract-base';
import { perFile } from '../support/per-file';
import { roleDirectory } from '../support/role-directory';
import { testFolderOf } from '../support/test-folder-of';

const SPEC = /\.(?:spec|test)\.ts$/;

interface Subject {
  readonly context: string;
  readonly name: string;
  /** The file name without `.ts`, and without the suffix of its role: a spec may carry either. */
  readonly base: string;
  readonly short: string;
  /** The module of the model that holds the file: its spec sits in `test/unit/<module>/`, or in `<module>/test/unit/`. */
  readonly module: string | undefined;
}

export const testSpecRequired: Rule = {
  id: 'test/spec-required',
  description:
    "Every aggregate, value object, domain service, command handler, query handler, domain event handler, integration event handler and job has a *.spec.ts in the context's test/; an abstract base is held by the specs of its implementations.",
  scope: 'project',
  run(project) {
    const specs = specsOf(project);

    return perFile(project, this.id, (file) => {
      const subject = subjectOf(file);

      if (
        subject === undefined ||
        specs.has(`${subject.context}/${subject.base}`) ||
        specs.has(`${subject.context}/${subject.short}`)
      ) {
        return [];
      }

      const { directory, ofModule } = testFolderOf(project, subject.context, subject.module);
      const unit = subject.module === undefined || ofModule ? 'unit' : `unit/${subject.module}`;
      const fix = `Create ${directory}${unit}/${subject.base}.spec.ts that names the expected behaviour in business language and exercises it without mocks.`;

      return [{ line: 1, message: `${subject.name} has no spec in ${directory}.`, fix }];
    });
  },
};

/** `<context>/<name without .spec.ts>` for every spec found on disk, in the test folder of the context, of one of its modules or of `shared/`. */
function specsOf(project: Project): Set<string> {
  const specs = project.contextEntries.flatMap((entry) => {
    const location = project.locate(entry);
    const name = path.posix.basename(entry);

    return inContext(location) && location.layer === 'test' && SPEC.test(name)
      ? [`${location.context}/${name.replace(SPEC, '')}`]
      : [];
  });

  return new Set(specs);
}

function subjectOf(file: SourceFile): Subject | undefined {
  if (!inContext(file.location) || file.isTest) {
    return undefined;
  }

  const name = path.posix.basename(file.path);
  const suffix = roleOf(roleDirectory(file.location))?.specFor?.find((candidate) => name.endsWith(candidate));

  if (suffix === undefined || isAbstractBase(file)) {
    return undefined;
  }

  return {
    context: file.location.context,
    name,
    base: name.slice(0, -'.ts'.length),
    short: name.slice(0, -suffix.length),
    module: file.location.module,
  };
}
