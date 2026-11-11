import path from 'node:path';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inContext } from '../support/in-context';
import { perFile } from '../support/per-file';
import { testFolderOf } from '../support/test-folder-of';

const AGGREGATE_SUFFIX = '.aggregate.ts';
const BUILDER_SUFFIX = '.builder.ts';

export const testBuilderRequired: Rule = {
  id: 'test/builder-required',
  description: 'An aggregate has a test data builder in test/builders/.',
  scope: 'project',
  run(project) {
    const builders = buildersOf(project);

    return perFile(project, this.id, (file) => {
      const aggregate = aggregateOf(file);

      if (aggregate === undefined || builders.has(`${aggregate.context}/${aggregate.base}`)) {
        return [];
      }

      const directory = `${testFolderOf(project, aggregate.context, aggregate.module).directory}builders/`;
      const fix = `Create ${directory}${aggregate.base}${BUILDER_SUFFIX} with valid defaults and methods named in the ubiquitous language, building through the public API of the aggregate.`;

      return [{ line: 1, message: `The aggregate ${aggregate.name} has no builder in ${directory}.`, fix }];
    });
  },
};

/** `<context>/<aggregate>` for every builder found on disk, in `test/builders/` of the context, of one of its modules or of `shared/`. */
function buildersOf(project: Project): Set<string> {
  const builders = project.contextEntries.flatMap((entry) => {
    const location = project.locate(entry);
    const name = path.posix.basename(entry);

    return inContext(location) &&
      location.layer === 'test' &&
      location.inside[0] === 'builders' &&
      name.endsWith(BUILDER_SUFFIX)
      ? [`${location.context}/${name.slice(0, -BUILDER_SUFFIX.length)}`]
      : [];
  });

  return new Set(builders);
}

interface Aggregate {
  readonly context: string;
  readonly name: string;
  readonly base: string;
  /** The module of the model that holds the aggregate, whose test folder may hold its builder. */
  readonly module: string | undefined;
}

function aggregateOf(file: SourceFile): Aggregate | undefined {
  if (!inContext(file.location) || file.isTest) {
    return undefined;
  }

  const { context, layer, inside, module } = file.location;
  const name = path.posix.basename(file.path);

  if (layer !== 'domain' || inside[0] !== 'aggregates' || !name.endsWith(AGGREGATE_SUFFIX)) {
    return undefined;
  }

  return { context, name, base: name.slice(0, -AGGREGATE_SUFFIX.length), module };
}
