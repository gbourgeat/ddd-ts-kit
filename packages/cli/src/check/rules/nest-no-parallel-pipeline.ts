import type { Layer } from '../model/layer';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { nestEquivalentsOf } from '../nest/nest-equivalents-of';
import { perFile } from '../support/per-file';

/** `domain/`, `application/` and the published language refuse every framework already (`layer/*`, `context/*`). */
const JUDGED: readonly Layer[] = ['presentation', 'infrastructure', 'module', 'root'];

export const nestNoParallelPipeline: Rule = {
  id: 'nest/no-parallel-pipeline',
  description:
    'A context uses none of the tools of Nest that the kit does its own way (controllers, guards, pipes, exception filters, interceptors, its logger, Swagger, CQRS, its scheduler): they would bypass the security, the errors and the contract of the kit. Nest stays in the platform.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!isJudged(file)) {
        return [];
      }

      return file.imports.flatMap(({ line, specifier, names, target }) => {
        const equivalents = target.kind === 'package' ? nestEquivalentsOf(target.name, names) : [];

        if (equivalents.length === 0) {
          return [];
        }

        return [
          {
            line,
            message: `"${specifier}" brings ${equivalents.map(({ tool }) => tool).join(' and ')} of Nest into a context, where the pipeline of the kit does not see it.`,
            fix: `Use ${equivalents.map(({ instead }) => instead).join('; and ')}.`,
          },
        ];
      });
    });
  },
};

function isJudged({ location, isTest }: SourceFile): boolean {
  return !isTest && location.area === 'context' && JUDGED.includes(location.layer);
}
