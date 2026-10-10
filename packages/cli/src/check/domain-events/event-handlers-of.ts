import { classesOf } from '../declarations/classes-of.js';
import type { DeclaredClass } from '../declarations/declared-class.js';
import { optionOf } from '../declarations/option-of.js';
import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { sourceAt } from '../project/source-at.js';
import { inLayer } from '../support/in-layer.js';
import type { EventHandler } from './event-handler.js';
import type { HandlerDependency } from './handler-dependency.js';
import { handlerDependencies } from './handler-dependencies.js';
import { isRegisteredAfterCommit } from './is-registered-after-commit.js';

const DECORATOR = 'DomainEventHandler';
const AFTER_COMMIT = 'after-commit';

/**
 * The domain event handlers a production file of a context holds: every class carrying
 * `@DomainEventHandler`, and the exported class of `application/event-handlers/*.event-handler.ts`
 * and of `application/integration/publishers/*.publisher.ts`. A declared class says its phase in
 * its decorator; any other is registered by the module file of its context.
 */
export function eventHandlersOf(project: Project, file: SourceFile): EventHandler[] {
  if (file.isTest || file.location.area !== 'context') return [];

  const { context } = file.location;
  const declared = classesOf(file.scan).filter(({ decorations }) => decorations.some(({ name }) => name === DECORATOR));
  const known = new Set(declared.map(({ name }) => name));
  const wired = isRoleFile(file) ? file.structure.classes.filter((shape) => shape.isExported && shape.depth === 0 && !known.has(shape.name)) : [];
  const module = wired.length === 0 ? undefined : sourceAt(project, `${project.config.contextsDir}/${context}/${context}.module.ts`);

  return [
    ...declared.map((handler) => ({ name: handler.name, line: handler.line, context, isAfterCommit: declaresAfterCommit(file, handler), dependencies: handlerDependencies(file, handler.name) })),
    ...wired.map(({ name, line }) => ({ name, line, context, isAfterCommit: isRegisteredAfterCommit(module, name), dependencies: [...handlerDependencies(file, name), ...boundByModule(module, { name, line })] })),
  ];
}

function isRoleFile(file: SourceFile): boolean {
  const [folder, inside] = inLayer(file, 'application')?.inside ?? [];

  if (folder === 'event-handlers') return file.path.endsWith('.event-handler.ts');

  return folder === 'integration' && inside === 'publishers' && file.path.endsWith('.publisher.ts');
}

function declaresAfterCommit(file: SourceFile, handler: DeclaredClass): boolean {
  return handler.decorations.some((decoration) => decoration.name === DECORATOR && optionOf(file.scan, decoration, 'phase')?.literal === AFTER_COMMIT);
}

/** The module file may write the dependency list of a class it binds: `.toClass(Handler, [..])`, reported at the class. */
function boundByModule(module: SourceFile | undefined, { name, line }: Pick<EventHandler, 'name' | 'line'>): HandlerDependency[] {
  return module === undefined ? [] : handlerDependencies(module, name).map((dependency) => ({ ...dependency, line }));
}
