import { isJobName } from '../../application/scheduling/is-job-name';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import type { DeclaredClass } from '../model/declared-class';
import type { ProjectionApplication } from '../model/projection-application';
import type { ProjectionFeed } from '../model/projection-feed';
import { DeclarationError } from '../registry/declaration-error';
import { record } from '../registry/record';
import { pendingApplications } from './pending-applications';
import type { ProjectionOptions } from './projection-options';

/**
 * A projector: the class that keeps one read model up to date, each of its `@On` methods
 * applying one event through a port of its own read model:
 * `@Projection('scheduling.appointment-list')`. The name is the consumer
 * it is subscribed as: stable, `<context>.<name>`, unique in the application.
 * `@Projection('scheduling.attendance-history', { feed: 'event-store' })` is fed from the event
 * store by a catch-up subscription instead of where the domain events are dispatched.
 */
export function Projection<const D extends DeclaredDependencies = DependenciesFromSignature>(
  name: `${string}.${string}`,
  dependencies?: D,
): ClassDeclarator<object, D>;
export function Projection<const D extends DeclaredDependencies = DependenciesFromSignature>(
  name: `${string}.${string}`,
  options: ProjectionOptions,
  dependencies?: D,
): ClassDeclarator<object, D>;

export function Projection(
  name: `${string}.${string}`,
  second?: DeclaredDependencies | ProjectionOptions,
  third?: DeclaredDependencies,
): ClassDeclarator<object, DeclaredDependencies> {
  if (!isJobName(name)) {
    throw new DeclarationError(
      `"${name}" is not a projection name: write <context>.<name> in lower case, words separated by dashes, as in 'scheduling.appointment-list'.`,
    );
  }

  const options = isOptions(second) ? second : undefined;
  const dependencies = isOptions(second) ? third : second;
  const feed = options?.feed ?? 'dispatch';

  return (target) => {
    const applies = claimed(target);

    if (applies.length === 0) {
      throw new DeclarationError(`Projection ${target.name} applies no event: write @On(...) on the methods that do.`);
    }

    assertFedBy(feed, target, applies);
    record(target, { role: 'projection', name, implementation: target, dependencies, feed, applies });
  };
}

function isOptions(value: DeclaredDependencies | ProjectionOptions): value is ProjectionOptions {
  return typeof value === 'object' && 'feed' in value;
}

/** A projection fed by the event store applies the domain events of its context, nothing else. */
function assertFedBy(feed: ProjectionFeed, target: DeclaredClass, applies: readonly ProjectionApplication[]): void {
  const integration = applies.find((application) => application.kind === 'integration');

  if (feed === 'event-store' && integration !== undefined) {
    throw new DeclarationError(
      `Projection ${target.name} is fed by the event store and applies the integration event of its method "${integration.method}": an integration event reaches a projection fed where it is consumed.`,
    );
  }
}

/** The `@On` of the methods of the class: they ran just before its `@Projection`. */
function claimed(target: DeclaredClass): readonly ProjectionApplication[] {
  const pending = pendingApplications().splice(0);
  const prototype: unknown = target.prototype;

  for (const { application, prototype: written } of pending) {
    const own = typeof prototype === 'object' && prototype !== null && Object.hasOwn(prototype, application.method);

    if (!own || (written !== undefined && written !== prototype)) {
      throw new DeclarationError(
        `@On is written on the method "${application.method}" of a class that carries no @Projection: found while declaring ${target.name}.`,
      );
    }
  }

  return pending.map(({ application }) => application);
}
