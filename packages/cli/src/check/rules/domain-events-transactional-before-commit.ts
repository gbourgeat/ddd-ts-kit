import { adapterFolders } from '../domain-events/adapter-folders';
import type { EventHandler } from '../domain-events/event-handler';
import { eventHandlersOf } from '../domain-events/event-handlers-of';
import type { HandlerDependency } from '../domain-events/handler-dependency';
import { refusedBeforeCommit } from '../domain-events/refused-before-commit';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import { perFile } from '../support/per-file';

const KERNEL = '@ddd-ts-kit/kernel';
const PUBLISHER = 'IntegrationEventPublisher';
const PERSISTENCE = 'persistence';

const BEFORE_FIX =
  "Declare the handler `phase: 'after-commit'` when its effect may be lost on a crash (it then runs at most once), or publish an integration event from a publisher (outbox, at least once) and do the work in the handler of that event when it must not be lost.";

const AFTER_FIX =
  'Send a command through the CommandBus port and let the publisher of the event that command records write to the outbox, or leave this handler before the commit: after the commit nothing makes the outbox row atomic with a state change.';

export const domainEventsTransactionalBeforeCommit: Rule = {
  id: 'domain-events/transactional-before-commit',
  description:
    'A domain event handler that runs before the commit has only effects the rollback undoes: it depends on the domain of its context, on persistence ports and on kernel ports other than Cache, CachePurger, Lock, RateLimiter, JobScheduler and EventBus; an after-commit handler never depends on IntegrationEventPublisher.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      eventHandlersOf(project, file).flatMap((handler) =>
        handler.isAfterCommit ? publishing(handler) : outsideTheTransaction(handler),
      ),
    );
  },
  acrossProject(project) {
    return perFile(project, this.id, (file) =>
      eventHandlersOf(project, file).flatMap((handler) =>
        handler.isAfterCommit ? [] : otherThanPersistence(project, handler),
      ),
    );
  },
};

/** After the commit, the outbox row would be written in no transaction. */
function publishing({ name, dependencies }: EventHandler): Finding[] {
  const publishers = dependencies.filter(
    ({ name: dependency, target }) => dependency === PUBLISHER && target.kind === 'package' && target.name === KERNEL,
  );

  return publishers.map(({ line }) => ({
    line,
    message: `${name} runs after the commit and depends on ${PUBLISHER}: the event it publishes would be committed apart from the state change it announces.`,
    fix: AFTER_FIX,
  }));
}

/** What one file shows: a kernel port no transaction covers, an adapter, another context, the platform, a foreign package. */
function outsideTheTransaction(handler: EventHandler): Finding[] {
  return handler.dependencies.flatMap((dependency) => {
    const why = refusedBeforeCommit(handler.context, dependency);

    return why === undefined ? [] : [survives(handler, dependency, why)];
  });
}

/** A port of `application/ports/` is transactional when its adapters, and all of them, live under `infrastructure/persistence/`. */
function otherThanPersistence(project: Project, handler: EventHandler): Finding[] {
  return handler.dependencies.flatMap((dependency) => {
    const { name, target } = dependency;

    if (!isOwnPort(handler, dependency) || target.kind !== 'file') {
      return [];
    }

    const folders = adapterFolders(project, { context: handler.context, name, path: target.path });
    const elsewhere = folders.find((folder) => folder !== PERSISTENCE);

    if (folders.length > 0 && elsewhere === undefined) {
      return [];
    }

    const why =
      elsewhere === undefined
        ? `which has no adapter under infrastructure/${PERSISTENCE}/`
        : `whose adapter is under infrastructure/${elsewhere}${elsewhere === '' ? '' : '/'}`;

    return [survives(handler, dependency, why)];
  });
}

function isOwnPort({ context }: EventHandler, { target }: HandlerDependency): boolean {
  if (target.kind !== 'file' || target.location.area !== 'context') {
    return false;
  }

  const { location } = target;

  return location.context === context && location.layer === 'application' && location.inside[0] === 'ports';
}

function survives(handler: EventHandler, { name, line }: HandlerDependency, why: string): Finding {
  return {
    line,
    message: `${handler.name} runs before the commit and depends on ${name}, ${why}: its effect would survive a rollback.`,
    fix: BEFORE_FIX,
  };
}
