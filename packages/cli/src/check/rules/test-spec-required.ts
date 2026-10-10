import path from 'node:path';
import { roleOf } from '../canonical/role-of.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';
import { roleDirectory } from '../support/role-directory.js';

const SPEC = /\.(?:spec|test)\.ts$/;

interface Subject {
  readonly context: string;
  readonly name: string;
  /** The file name without `.ts`, and without the suffix of its role: a spec may carry either. */
  readonly base: string;
  readonly short: string;
}

export const testSpecRequired: Rule = {
  id: 'test/spec-required',
  description: "Every aggregate, value object, domain service, command handler, query handler, domain event handler, integration event handler and job has a *.spec.ts in the context's test/.",
  scope: 'project',
  run(project) {
    const { contextsDir } = project.config;
    const specs = specsOf(project.contextEntries, contextsDir);

    return perFile(project, this.id, (file) => {
      const subject = subjectOf(file);

      if (subject === undefined || specs.has(`${subject.context}/${subject.base}`) || specs.has(`${subject.context}/${subject.short}`)) return [];

      const directory = `${contextsDir}/${subject.context}/test/`;
      const fix = `Create ${directory}unit/${subject.base}.spec.ts that names the expected behaviour in business language and exercises it without mocks.`;

      return [{ line: 1, message: `${subject.name} has no spec in ${directory}.`, fix }];
    });
  },
};

/** `<context>/<name without .spec.ts>` for every spec found on disk. */
function specsOf(entries: readonly string[], contextsDir: string): Set<string> {
  const specs = entries.flatMap((entry) => {
    const [context = '', top, ...rest] = entry.slice(contextsDir.length + 1).split('/');
    const name = rest.at(-1) ?? '';

    return top === 'test' && SPEC.test(name) ? [`${context}/${name.replace(SPEC, '')}`] : [];
  });

  return new Set(specs);
}

function subjectOf(file: SourceFile): Subject | undefined {
  if (!inContext(file.location) || file.isTest) return undefined;

  const name = path.posix.basename(file.path);
  const suffix = roleOf(roleDirectory(file.location))?.specFor?.find((candidate) => name.endsWith(candidate));

  if (suffix === undefined) return undefined;

  return { context: file.location.context, name, base: name.slice(0, -'.ts'.length), short: name.slice(0, -suffix.length) };
}
