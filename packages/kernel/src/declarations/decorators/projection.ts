import { isJobName } from '../../application/scheduling/is-job-name.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { Dependencies } from '../dependencies/dependencies.js';
import type { DeclaredClass } from '../model/declared-class.js';
import type { ProjectionApplication } from '../model/projection-application.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { record } from '../registry/record.js';
import { pendingApplications } from './pending-applications.js';

/**
 * A projector: the class that keeps one read model up to date, each of its `@On` methods
 * applying one event through a port of its own read model:
 * `@Projection('scheduling.appointment-list', [AppointmentList])`. The name is the consumer
 * it is subscribed as: stable, `<context>.<name>`, unique in the application.
 */
export function Projection<const D extends Dependencies = readonly []>(
  name: `${string}.${string}`,
  dependencies?: D,
): ClassDeclarator<object, D> {
  if (!isJobName(name)) {
    throw new DeclarationError(
      `"${name}" is not a projection name: write <context>.<name> in lower case, words separated by dashes, as in 'scheduling.appointment-list'.`,
    );
  }

  return (target) => {
    const applies = claimed(target);

    if (applies.length === 0) {
      throw new DeclarationError(`Projection ${target.name} applies no event: write @On(...) on the methods that do.`);
    }

    record(target, { role: 'projection', name, implementation: target, dependencies: dependencies ?? [], applies });
  };
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
