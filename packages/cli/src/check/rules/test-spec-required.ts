import path from 'node:path';
import { roleOf } from '../canonical.js';
import type { Rule, SourceFile } from '../types.js';
import { inContext, reporter } from './helpers.js';

export const testSpecRequired: Rule = {
  id: 'test/spec-required',
  description:
    "Every aggregate, value object, domain service, command handler, query handler, event handler and consumer has a *.spec.ts in the context's test/.",
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    const { contextsDir } = project.config;
    const specs = specsOf(project.contextEntries, contextsDir);
    return project.files.flatMap((file) => {
      const subject = subjectOf(file);
      if (subject === undefined || specs.has(`${subject.context}/${subject.base}`) || specs.has(`${subject.context}/${subject.short}`)) return [];
      return [
        report(
          { file: file.path, line: 1 },
          `${subject.name} has no spec in ${contextsDir}/${subject.context}/test/.`,
          `Create ${contextsDir}/${subject.context}/test/unit/${subject.base}.spec.ts that names the expected behaviour in business language and exercises it without mocks.`,
        ),
      ];
    });
  },
};

const SPEC = /\.(?:spec|test)\.ts$/;

/** `<context>/<name without .spec.ts>` for every spec found on disk. */
function specsOf(entries: readonly string[], contextsDir: string): Set<string> {
  const specs = entries.flatMap((entry) => {
    const [context = '', top, ...rest] = entry.slice(contextsDir.length + 1).split('/');
    const name = rest.at(-1) ?? '';
    return top === 'test' && SPEC.test(name) ? [`${context}/${name.replace(SPEC, '')}`] : [];
  });
  return new Set(specs);
}

interface Subject {
  readonly context: string;
  readonly name: string;
  /** The file name without `.ts`, and without the suffix of its role: a spec may carry either. */
  readonly base: string;
  readonly short: string;
}

function subjectOf(file: SourceFile): Subject | undefined {
  if (!inContext(file.location) || file.isTest) return undefined;
  const { context, layer, inside } = file.location;
  const role = roleOf([layer, ...inside.slice(0, -1)].join('/'));
  const name = path.posix.basename(file.path);
  const suffix = role?.specFor?.find((candidate) => name.endsWith(candidate));
  if (suffix === undefined) return undefined;
  return { context, name, base: name.slice(0, -'.ts'.length), short: name.slice(0, -suffix.length) };
}
