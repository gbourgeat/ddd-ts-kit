import { consumerRegistrations, type ConsumerRegistration } from '../consumer-registrations.js';
import { exportedClass, identifier } from '../text-shapes.js';
import type { Project, Rule, SourceFile } from '../types.js';
import { inContext, inLayer, reporter, toViolations, type Finding } from './helpers.js';

const NAME_FIX =
  'Give each consumer its own stable name, `<context>.<what-it-does>`: the processed-event store deduplicates per consumer name, so two consumers sharing one skip the events of each other.';

export const eventsConsumerIdempotent: Rule = {
  id: 'events/consumer-idempotent',
  description: 'Every consumer is registered with a stable consumer name, unique in the project, and a processed-event store.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.filter((file) => !file.isTest).flatMap((file) => toViolations(report, file.path, flawedRegistrations(consumerRegistrations(file))));
  },
  acrossProject(project) {
    const report = reporter(project, this.id);
    const sources = project.files.filter((file) => !file.isTest);
    const firstUse = new Map<string, string>();
    return sources.flatMap((file) => toViolations(report, file.path, [...unregistered(file, project), ...namesTakenElsewhere(file, firstUse)]));
  },
};

/** What one file shows alone: a name used twice, a subscription without a processed-event store. */
function flawedRegistrations(registrations: readonly ConsumerRegistration[]): Finding[] {
  const seen = new Set<string>();
  return registrations.flatMap((registration) => {
    const findings: Finding[] = [];
    if (!registration.deduplicates) {
      const fix = 'Pass `processed` (the processed-event store) and `unitOfWork` in the options, or use consume(definition, { consumer, processed, unitOfWork }, handler): delivery is at least once, so a redelivery must be recognised.';
      findings.push({ line: registration.line, message: 'A consumer is subscribed without a processed-event store.', fix });
    }
    if (registration.name !== undefined && seen.has(registration.name)) {
      findings.push({ line: registration.nameLine, message: `The consumer name "${registration.name}" is used twice in this file.`, fix: NAME_FIX });
    }
    if (registration.name !== undefined) seen.add(registration.name);
    return findings;
  });
}

function unregistered(file: SourceFile, project: Project): Finding[] {
  const here = inLayer(file, 'application');
  if (here === undefined || here.inside.slice(0, 2).join('/') !== 'integration/consumers' || !file.path.endsWith('.consumer.ts')) return [];
  const consumer = exportedClass(file);
  const module = project.files.find(({ location }) => inContext(location) && location.context === here.context && location.layer === 'module');
  // A consumer written as a subscription (no class) registers itself; without a module file there is nowhere to look.
  if (consumer === undefined || module === undefined || consumerRegistrations(file).length > 0) return [];
  const instance = consumer.name.charAt(0).toLowerCase() + consumer.name.slice(1);
  const token = consumer.name.replace(/(?<=[a-z0-9])(?=[A-Z])/g, '_').toUpperCase();
  const names = [consumer.name, instance, token].map(identifier);
  if (consumerRegistrations(module).some(({ code }) => names.some((name) => name.test(code)))) return [];
  return [
    {
      line: consumer.line,
      message: `The consumer ${consumer.name} is not registered with a consumer name in ${module.path}.`,
      fix: `Register it there under a stable name: builder.on(<definition>, { consumer: '${here.context}.<name>' }).handledBy(${consumer.name}, [...]), or consume(<definition>, { consumer: '${here.context}.<name>', processed, unitOfWork }, (event) => ${instance}.handle(event)).`,
    },
  ];
}

/** `firstUse` remembers, across the files of the project, where each consumer name was first seen. */
function namesTakenElsewhere(file: SourceFile, firstUse: Map<string, string>): Finding[] {
  return consumerRegistrations(file).flatMap(({ name, nameLine }) => {
    if (name === undefined) return [];
    const first = firstUse.get(name);
    if (first === undefined) firstUse.set(name, file.path);
    if (first === undefined || first === file.path) return [];
    return [{ line: nameLine, message: `The consumer name "${name}" is already used in ${first}.`, fix: NAME_FIX }];
  });
}
