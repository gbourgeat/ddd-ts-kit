import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type {
  DomainEventApplication,
  IntegrationEventApplication,
  ProjectionDeclaration,
} from '@ddd-ts-kit/kernel/declarations';
import { observedProjection } from '../consumer/observed-projection.js';
import { receive } from '../consumer/receive.js';
import type { Declarer } from '../wiring/declarer.js';
import type { DomainEventHandling } from '../wiring/domain-event-handling.js';
import type { EventConsumption } from '../wiring/event-consumption.js';
import type { ProjectionRegistration } from '../wiring/projection-registration.js';
import { applyThrough } from './apply-through.js';

interface Declared {
  readonly declaration: ProjectionDeclaration;
  readonly module: string;
  readonly declaredBy: Declarer;
}

export interface WiredProjection {
  readonly registration: ProjectionRegistration;
  readonly consumptions: readonly EventConsumption[];
  readonly domainEventHandlers: readonly DomainEventHandling[];
}

/**
 * What a declared projection adds to the wiring. Each integration event it applies is a
 * consumption under the name of the projection: the same execution scope, unit of work and
 * processed mark as a handler of integration events, and the same `process <consumer>` span. Each domain
 * event of its own context is applied where it is dispatched, inside the save.
 */
export function projectionOf(declared: Declared): WiredProjection {
  const { declaration, module, declaredBy } = declared;
  const { name, implementation, applies, feed } = declaration;

  return {
    registration: {
      name,
      projection: implementation,
      module,
      feed,
      declaredBy,
      applies: applies.map((application) =>
        application.kind === 'integration'
          ? {
              kind: 'integration',
              event: application.contract.type,
              version: application.contract.version,
              method: application.method,
            }
          : { kind: 'domain', event: application.name, method: application.method },
      ),
    },
    consumptions: applies.flatMap((application) =>
      application.kind === 'integration' ? [consumptionOf(declared, application)] : [],
    ),
    // Fed by the event store: a catch-up subscription applies its domain events, the dispatcher does not.
    domainEventHandlers: applies.flatMap((application) =>
      application.kind === 'domain' && feed === 'dispatch' ? [handlingOf(declared, application)] : [],
    ),
  };
}

function consumptionOf(
  { declaration, module, declaredBy }: Declared,
  { contract, method }: IntegrationEventApplication,
): EventConsumption {
  const { name, implementation } = declaration;

  return {
    type: contract.type,
    version: contract.version,
    consumer: name,
    handler: implementation,
    module,
    declaredBy,
    projection: name,
    subscribe: (resolve, runtime) => {
      const observed = observedProjection(resolve, { projection: name, context: module, event: contract.type });

      return receive({
        contract,
        options: { consumer: name },
        runtime,
        handle: (event) =>
          observed(new Date(event.occurredAt), () => applyThrough(resolve(implementation), method, event)),
      });
    },
  };
}

function handlingOf(
  { declaration, module, declaredBy }: Declared,
  { event, name, method }: DomainEventApplication,
): DomainEventHandling {
  const { implementation } = declaration;

  return {
    name,
    phase: 'before-commit',
    event: event.name,
    handler: implementation,
    module,
    declaredBy,
    projection: declaration.name,
    attach: (resolve, dispatcher) => {
      const observed = observedProjection(resolve, { projection: declaration.name, context: module, event: name });

      dispatcher.on(name, async (occurred: DomainEvent) => {
        if (occurred instanceof event) {
          await observed(occurred.occurredAt, () => applyThrough(resolve(implementation), method, occurred));
        }
      });
    },
  };
}
