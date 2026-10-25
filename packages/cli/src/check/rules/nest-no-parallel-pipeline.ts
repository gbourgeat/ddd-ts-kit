import type { Finding } from '../model/finding';
import type { Layer } from '../model/layer';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { nestEquivalentsOf } from '../nest/nest-equivalents-of';
import { perFile } from '../support/per-file';

/** `domain/`, `application/` and the published language refuse every framework already (`layer/*`, `context/*`). */
const JUDGED: readonly Layer[] = ['presentation', 'infrastructure', 'module', 'root'];
const NEST_COMMON = '@nestjs/common';
const NEST_BRIDGE = '@ddd-ts-kit/http/nest';
/** What a controller sends a use case through. */
const BUSES = ['CommandBus', 'QueryBus'];

const ROUTED_BY_NEST_FIX =
  'Make it a route of the kit: `@KitRoute` of `@ddd-ts-kit/http/nest` on each method, served by `createControllersModule`, with its guards, its refusals and its place in the contract. A controller of Nest stays for what reaches no use case (health, metrics).';

export const nestNoParallelPipeline: Rule = {
  id: 'nest/no-parallel-pipeline',
  description:
    "A context uses none of the tools of Nest that the kit does its own way (guards, pipes, exception filters, interceptors, its logger, Swagger, CQRS, its scheduler, a controller Nest serves): they would bypass the security, the errors and the contract of the kit. A Nest controller the kit serves (`@KitRoute`) declares its routes with Nest's decorators. Outside the contexts, a controller Nest serves reaches no use case. Nest stays in the platform for the rest.",
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (file.isTest) {
        return [];
      }

      if (file.location.area === 'context') {
        return JUDGED.includes(file.location.layer) ? nestToolsIn(file) : [];
      }

      return isUnderSources(file, project) ? routedByNest(file) : [];
    });
  },
};

/** In a context: each import of a tool of Nest whose work the kit does. */
function nestToolsIn(file: SourceFile): Finding[] {
  const servedByKit = servesThroughTheKit(file);

  return file.imports.flatMap(({ line, specifier, names, target }) => {
    const equivalents = target.kind === 'package' ? nestEquivalentsOf(target.name, names, servedByKit) : [];

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
}

/**
 * Outside the contexts: a controller Nest serves that reaches a use case, through a bus or a file of
 * a context, is a route with none of the guarantees of the kit, wherever it is written.
 */
function routedByNest(file: SourceFile): Finding[] {
  const controller = file.imports.find(
    ({ target, names }) => target.kind === 'package' && target.name === NEST_COMMON && names.includes('Controller'),
  );

  if (controller === undefined || servesThroughTheKit(file) || !reachesUseCase(file)) {
    return [];
  }

  return [
    {
      line: controller.line,
      message:
        'A controller Nest serves reaches a use case: its routes have no declared security, no problem codes and no place in the contract.',
      fix: ROUTED_BY_NEST_FIX,
    },
  ];
}

function servesThroughTheKit(file: SourceFile): boolean {
  return file.imports.some(
    ({ specifier, names }) => specifier === NEST_BRIDGE && (names.includes('KitRoute') || names.includes('KitRoutes')),
  );
}

function reachesUseCase(file: SourceFile): boolean {
  return file.imports.some(
    ({ target, names }) =>
      (target.kind === 'file' && target.location.area === 'context') ||
      (target.kind === 'package' && names.some((name) => BUSES.includes(name))),
  );
}

function isUnderSources({ path }: SourceFile, { config }: Project): boolean {
  return path.startsWith(`${config.sourceRoot}/`);
}
