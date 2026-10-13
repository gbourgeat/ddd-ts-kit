import type { TokenMap } from '../token/token-map.js';
import type { BackgroundJobRegistration } from './background-job-registration.js';
import type { Binding } from './binding.js';
import type { DomainEventHandling } from './domain-event-handling.js';
import type { EdgeBinding } from './edge-binding.js';
import type { EventConsumption } from './event-consumption.js';
import type { JobRegistration } from './job-registration.js';
import type { KindAspect } from './kind-aspect.js';
import type { MessageHandling } from './message-handling.js';
import type { PolicyBinding } from './policy-binding.js';
import type { ProjectionRegistration } from './projection-registration.js';

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
