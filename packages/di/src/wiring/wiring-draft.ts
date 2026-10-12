import { describeToken } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error.js';
import { TokenMap } from '../token/token-map.js';
import type { Binding } from './binding.js';
import type { DomainEventHandling } from './domain-event-handling.js';
import type { EdgeBinding } from './edge-binding.js';
import type { EventConsumption } from './event-consumption.js';
import type { JobRegistration } from './job-registration.js';
import type { KindAspect } from './kind-aspect.js';
import type { MessageHandling } from './message-handling.js';
import type { PolicyBinding } from './policy-binding.js';
import type { ProjectionRegistration } from './projection-registration.js';
import { whereOf } from './where-of.js';
import type { Wiring } from './wiring.js';

/** The wiring while the modules declare it: every addition is checked against what is already there. */
export class WiringDraft {
  private readonly bindings = new TokenMap<Binding>();

  private readonly handlings: MessageHandling[] = [];

  private readonly consumptions: EventConsumption[] = [];

  private readonly domainEventHandlers: DomainEventHandling[] = [];

  private readonly policies: PolicyBinding[] = [];

  private readonly jobs: JobRegistration[] = [];

  private readonly projections: ProjectionRegistration[] = [];

  private readonly edges: EdgeBinding[] = [];

  private readonly kindAspects: KindAspect[] = [];

  addBinding(binding: Binding): void {
    const existing = this.bindings.get(binding.token);

    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_BINDING',
        `Token "${describeToken(binding.token)}" is bound twice: by ${whereOf(existing)} and by ${whereOf(binding)}.`,
      );
    }

    this.bindings.set(binding.token, binding);
  }

  replaceBinding(binding: Binding): void {
    if (!this.bindings.has(binding.token)) {
      throw new WiringError(
        'NOTHING_TO_REBIND',
        `${capitalized(whereOf(binding))} rebinds "${describeToken(binding.token)}", which no earlier module binds. List the module that binds it first, or use bind.`,
      );
    }

    this.bindings.set(binding.token, binding);
  }

  addHandling(handling: MessageHandling): void {
    const existing = this.handlings.find((other) => other.kind === handling.kind && other.message === handling.message);

    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_HANDLER',
        `The ${handling.kind} "${handling.message.name}" has two handlers: "${describeToken(existing.handler)}" in ${whereOf(existing)} and "${describeToken(handling.handler)}" in ${whereOf(handling)}.`,
      );
    }

    this.handlings.push(handling);
  }

  addConsumption(consumption: EventConsumption): void {
    const { consumer, type, version } = consumption;

    const existing = this.consumptions.find(
      (other) => other.consumer === consumer && other.type === type && other.version === version,
    );

    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_CONSUMER',
        `Consumer "${consumer}" is declared twice for ${type} v${version}: in ${whereOf(existing)} and in ${whereOf(consumption)}. Sharing a name would make one of them skip every event.`,
      );
    }

    this.consumptions.push(consumption);
  }

  addJob(registration: JobRegistration): void {
    const existing = this.jobs.find((other) => other.name === registration.name);

    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_JOB',
        `Job "${registration.name}" is declared twice: in ${whereOf(existing)} and in ${whereOf(registration)}. The name of a job is its lock, its actor and its label: it is unique in an application.`,
      );
    }

    this.jobs.push(registration);
  }

  addProjection(registration: ProjectionRegistration): void {
    const existing = this.projections.find((other) => other.name === registration.name);

    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_PROJECTION',
        `Projection "${registration.name}" is declared twice: in ${whereOf(existing)} and in ${whereOf(registration)}. The name of a projection is the consumer its events are subscribed as: it is unique in an application.`,
      );
    }

    this.projections.push(registration);
  }

  addDomainEventHandler(handling: DomainEventHandling): void {
    this.domainEventHandlers.push(handling);
  }

  addPolicy(policy: PolicyBinding): void {
    this.policies.push(policy);
  }

  addEdge(edge: EdgeBinding): void {
    this.edges.push(edge);
  }

  addKindAspect(aspect: KindAspect): void {
    this.kindAspects.push(aspect);
  }

  wiring(modules: readonly string[]): Wiring {
    return {
      modules,
      bindings: this.bindings,
      handlings: this.handlings,
      consumptions: this.consumptions,
      domainEventHandlers: this.domainEventHandlers,
      policies: this.policies,
      jobs: this.jobs,
      projections: this.projections,
      edges: this.edges,
      kindAspects: this.kindAspects,
    };
  }
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
