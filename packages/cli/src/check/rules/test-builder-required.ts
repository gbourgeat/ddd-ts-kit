import path from 'node:path';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

const AGGREGATE_SUFFIX = '.aggregate.ts';
const BUILDER_SUFFIX = '.builder.ts';

export const testBuilderRequired: Rule = {
  id: 'test/builder-required',
  description: 'An aggregate has a test data builder in test/builders/.',
  scope: 'project',
  run(project) {
    const { contextsDir } = project.config;
    const builders = buildersOf(project.contextEntries, contextsDir);

    return perFile(project, this.id, (file) => {
      const aggregate = aggregateOf(file);

      if (aggregate === undefined || builders.has(`${aggregate.context}/${aggregate.base}`)) return [];

      const directory = `${contextsDir}/${aggregate.context}/test/builders/`;
      const fix = `Create ${directory}${aggregate.base}${BUILDER_SUFFIX} with valid defaults and methods named in the ubiquitous language, building through the public API of the aggregate.`;

      return [{ line: 1, message: `The aggregate ${aggregate.name} has no builder in ${directory}.`, fix }];
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
