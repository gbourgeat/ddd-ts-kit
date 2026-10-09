import path from 'node:path';
import type { Rule, SourceFile } from '../types.js';
import { inContext, reporter } from './helpers.js';

const AGGREGATE_SUFFIX = '.aggregate.ts';
const BUILDER_SUFFIX = '.builder.ts';

export const testBuilderRequired: Rule = {
  id: 'test/builder-required',
  description: 'An aggregate has a test data builder in test/builders/.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    const { contextsDir } = project.config;
    const builders = buildersOf(project.contextEntries, contextsDir);
    return project.files.flatMap((file) => {
      const aggregate = aggregateOf(file);
      if (aggregate === undefined || builders.has(`${aggregate.context}/${aggregate.base}`)) return [];
      const directory = `${contextsDir}/${aggregate.context}/test/builders/`;
      return [
        report(
          { file: file.path, line: 1 },
          `The aggregate ${aggregate.name} has no builder in ${directory}.`,
          `Create ${directory}${aggregate.base}${BUILDER_SUFFIX} with valid defaults and methods named in the ubiquitous language, building through the public API of the aggregate.`,
        ),
      ];
    });
  },
};

/** `<context>/<aggregate>` for every builder found on disk. */
function buildersOf(entries: readonly string[], contextsDir: string): Set<string> {
  const builders = entries.flatMap((entry) => {
    const [context = '', top, folder, ...rest] = entry.slice(contextsDir.length + 1).split('/');
    const name = rest.at(-1) ?? '';
    return top === 'test' && folder === 'builders' && name.endsWith(BUILDER_SUFFIX) ? [`${context}/${name.slice(0, -BUILDER_SUFFIX.length)}`] : [];
  });
  return new Set(builders);
}

function aggregateOf(file: SourceFile): { context: string; name: string; base: string } | undefined {
  if (!inContext(file.location) || file.isTest) return undefined;
  const { context, layer, inside } = file.location;
  const name = path.posix.basename(file.path);
  if (layer !== 'domain' || inside[0] !== 'aggregates' || !name.endsWith(AGGREGATE_SUFFIX)) return undefined;
  return { context, name, base: name.slice(0, -AGGREGATE_SUFFIX.length) };
}
