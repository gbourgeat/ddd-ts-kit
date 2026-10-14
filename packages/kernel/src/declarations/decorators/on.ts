import type { IntegrationEvent } from '../../application/events/integration-event.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import type { EventContract } from '../model/event-contract.js';
import type { ProjectionApplication } from '../model/projection-application.js';
import { DeclarationError } from '../registry/declaration-error.js';
import type { NamedDomainEventType } from '../model/named-domain-event-type.js';
import { eventNameOf } from './event-name-of.js';
import type { Named } from './named.js';
import { pendingApplications } from './pending-applications.js';
import type { ProjectionMethodDecorator } from './projection-method-decorator.js';

type Applied =
  | Omit<Extract<ProjectionApplication, { kind: 'integration' }>, 'method'>
  | Omit<Extract<ProjectionApplication, { kind: 'domain' }>, 'method'>;

/**
 * On a method of a `@Projection` class: this method applies that event.
 * `@On(PractitionerRenamed)` for an integration event of an upstream context,
 * `@On(AppointmentBooked)` for a domain event of the projection's own context, applied under
 * the name its class declares once (`static readonly eventName`). The method receives the event
 * and answers what its store answered.
 */
export function On<Payload>(contract: EventContract<Payload>): ProjectionMethodDecorator<IntegrationEvent<Payload>>;
export function On<E extends DomainEvent, const Name extends string>(
  event: NamedDomainEventType<E, Name> & Named<Name, 'eventName'>,
): ProjectionMethodDecorator<E>;

export function On(
  source: EventContract<unknown> | NamedDomainEventType<DomainEvent>,
): ProjectionMethodDecorator<never> {
  const applied = appliedOf(source);

  return (target: unknown, second: unknown): void => {
    const standard = typeof second === 'object' && second !== null;
    const name: unknown = standard && 'name' in second ? second.name : second;

    if (typeof name !== 'string' || (standard && isHidden(second))) {
      throw misplaced();
    }

    pendingApplications().push({
      application: { ...applied, method: name },
      ...(standard || typeof target !== 'object' || target === null ? {} : { prototype: target }),
    });
  };
}

function appliedOf(source: EventContract<unknown> | NamedDomainEventType<DomainEvent>): Applied {
  if (typeof source !== 'function') {
    return { kind: 'integration', contract: source };
  }

  return { kind: 'domain', event: source, name: eventNameOf(source, 'A projection') };
}

function isHidden(context: object): boolean {
  return ('static' in context && context.static === true) || ('private' in context && context.private === true);
}

function misplaced(): DeclarationError {
  return new DeclarationError('@On is written on a public instance method with a string name.');
}
