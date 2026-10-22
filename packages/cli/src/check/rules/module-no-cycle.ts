import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { cyclesIn } from '../support/cycles-in.js';
import { reporter } from '../support/reporter.js';

const FIX =
  'Look for a way to change the model to disentangle the concepts (Evans, Modules): an effect that follows a decision of one module becomes a domain event the other handles; a concept both reach for may be an overlooked module of its own, which both import; reads of the other module can go through a projection of its events. Coupling between modules is a signal about the model, which is why this is a warning.';

/** One import from a file of one module to a file of another module of the same context: where it is written. */
interface Edge {
  readonly from: string;
  readonly to: string;
  readonly file: string;
  readonly line: number;
}

export const moduleNoCycle: Rule = {
  id: 'module/no-cycle',
  description:
    'The production files of the modules of the model of one context import each other in no cycle: when a module imports another, the other does not import it back, directly or through a third. A warning: coupling between modules is a signal to change the model, not a refusal.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return [...edgesByContext(project)].flatMap(([context, edges]) => {
      const modules = [...new Set(edges.map((edge) => edge.from))].sort();

      const next = (module: string): string[] => [
        ...new Set(edges.filter((edge) => edge.from === module).map((edge) => edge.to)),
      ];

      return cyclesIn(modules, next).map((cycle) => {
        const [first = '', second = ''] = cycle;
        const edge = edges.find((candidate) => candidate.from === first && candidate.to === second);

        return report(
          { file: edge?.file ?? '', line: edge?.line ?? 1 },
          `The modules of the model of "${context}" import each other in a cycle: ${[...cycle, first].join(' -> ')}.`,
          FIX,
        );
      });
    });
  },
};

function edgesByContext(project: Project): Map<string, Edge[]> {
  const byContext = new Map<string, Edge[]>();

  for (const file of project.files.filter((candidate) => !candidate.isTest)) {
    for (const edge of edgesOf(file)) {
      byContext.set(edge.context, [...(byContext.get(edge.context) ?? []), edge]);
    }
  }

  return byContext;
}

/** The imports of a file of one module of the model to another module of the same context. */
function edgesOf({ location, imports, path }: SourceFile): (Edge & { readonly context: string })[] {
  if (location.area !== 'context' || location.module === undefined) {
    return [];
  }

  const { context, module: from } = location;

  return imports.flatMap(({ target, line }) => {
    const to = target.kind === 'file' && target.location.area === 'context' ? target.location : undefined;

    return to?.context === context && to.module !== undefined && to.module !== from
      ? [{ context, from, to: to.module, file: path, line }]
      : [];
  });
}
