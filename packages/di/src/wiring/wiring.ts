import type { TokenMap } from '../token/token-map';
import type { BackgroundJobRegistration } from './background-job-registration';
import type { Binding } from './binding';
import type { DomainEventHandling } from './domain-event-handling';
import type { EdgeBinding } from './edge-binding';
import type { EventConsumption } from './event-consumption';
import type { JobRegistration } from './job-registration';
import type { KindAspect } from './kind-aspect';
import type { MessageHandling } from './message-handling';
import type { PolicyBinding } from './policy-binding';
import type { ProjectionRegistration } from './projection-registration';

/** What the modules of an application declared, before anything is instantiated. */
export interface Wiring {
  readonly modules: readonly string[];
  readonly bindings: TokenMap<Binding>;
  readonly handlings: readonly MessageHandling[];
  readonly consumptions: readonly EventConsumption[];
  readonly domainEventHandlers: readonly DomainEventHandling[];
  readonly policies: readonly PolicyBinding[];
  readonly jobs: readonly JobRegistration[];
  readonly backgroundJobs: readonly BackgroundJobRegistration[];
  readonly projections: readonly ProjectionRegistration[];
  readonly edges: readonly EdgeBinding[];
  /** Outermost first. */
  readonly kindAspects: readonly KindAspect[];
}
