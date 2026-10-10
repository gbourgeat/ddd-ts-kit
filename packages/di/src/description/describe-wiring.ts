import { describeJobSchedule, type MessageInfo } from '@ddd-ts-kit/kernel';
import { describeToken } from '@ddd-ts-kit/kernel/declarations';
import type { EffectiveJob } from '../jobs/effective-job.js';
import type { TokenSet } from '../token/token-set.js';
import type { Binding } from '../wiring/binding.js';
import type { Declarer } from '../wiring/declarer.js';
import type { DomainEventHandling } from '../wiring/domain-event-handling.js';
import type { EventConsumption } from '../wiring/event-consumption.js';
import type { PolicyBinding } from '../wiring/policy-binding.js';
import type { ProjectionRegistration } from '../wiring/projection-registration.js';
import type { Wiring } from '../wiring/wiring.js';
import type {
  BindingDescription,
  DomainEventHandlerDescription,
  HandlerDescription,
  IntegrationEventHandlerDescription,
  OriginDescription,
  PolicyDescription,
  ProjectionDescription,
  ScheduledJobDescription,
  WiringDescription,
} from './wiring-description.js';

export function describeWiring(wiring: Wiring, overridden: TokenSet, jobs: readonly EffectiveJob[]): WiringDescription {
  return {
    modules: wiring.modules,
    bindings: wiring.bindings.values().map((binding) => describeBinding(binding, overridden)),
    commands: describeHandlers(wiring, 'command'),
    queries: describeHandlers(wiring, 'query'),
    integrationEventHandlers: wiring.consumptions
      .filter(({ projection }) => projection === undefined)
      .map(describeConsumption),
    domainEventHandlers: wiring.domainEventHandlers
      .filter(({ projection }) => projection === undefined)
      .map(describeDomainEventHandler),
    policies: wiring.policies.map(describePolicy),
    jobs: jobs.map(describeJob),
    projections: wiring.projections.map(describeProjection),
    overrides: overridden.tokens().map(describeToken),
  };
}

function describeBinding(binding: Binding, overridden: TokenSet): BindingDescription {
  return {
    token: describeToken(binding.token),
    module: binding.module,
    ...(binding.kind === undefined ? {} : { kind: binding.kind }),
    lifetime: binding.lifetime,
    source: binding.source,
    ...(binding.implementation === undefined ? {} : { implementation: binding.implementation }),
    dependencies: binding.dependencies.map(describeToken),
    overridden: overridden.has(binding.token),
    ...originOf(binding.declaredBy),
  };
}

function originOf(declaredBy: Declarer | undefined): OriginDescription {
  if (declaredBy === undefined) {
    return {};
  }

  const { className, file } = declaredBy;

  return { origin: 'declared', declaredBy: className, ...(file === undefined ? {} : { file }) };
}

function describeHandlers(wiring: Wiring, kind: MessageInfo['kind']): HandlerDescription[] {
  return wiring.handlings
    .filter((handling) => handling.kind === kind)
    .map(({ message, handler, module, requirement, declaredBy }) => ({
      message: message.name,
      handler: describeToken(handler),
      module,
      ...(requirement.access === undefined ? {} : { access: requirement.access }),
      ...(requirement.permission === undefined ? {} : { permission: requirement.permission.id }),
      ...originOf(declaredBy),
    }));
}

function describeConsumption(consumption: EventConsumption): IntegrationEventHandlerDescription {
  const { type, version, consumer, handler, module, declaredBy } = consumption;

  return { event: type, version, consumer, handler: describeToken(handler), module, ...originOf(declaredBy) };
}

function describeDomainEventHandler(handling: DomainEventHandling): DomainEventHandlerDescription {
  const { event, name, phase, handler, module, declaredBy } = handling;

  return { event, name, phase, handler: describeToken(handler), module, ...originOf(declaredBy) };
}

function describePolicy({ name, permission, policy, module, declaredBy }: PolicyBinding): PolicyDescription {
  return { name, permission: permission.id, policy: describeToken(policy), module, ...originOf(declaredBy) };
}

function describeJob({ name, schedule, policy, job, module, declaredBy }: EffectiveJob): ScheduledJobDescription {
  return {
    name,
    schedule: describeJobSchedule(schedule),
    ...policy,
    job: describeToken(job),
    module,
    ...originOf(declaredBy),
  };
}

function describeProjection({
  name,
  projection,
  module,
  applies,
  declaredBy,
}: ProjectionRegistration): ProjectionDescription {
  return { name, projection: describeToken(projection), module, applies, ...originOf(declaredBy) };
}
