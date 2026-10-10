import { consumerRegistrations } from '../consumer-registrations.js';
import { declaredEventHandlers, type DeclaredEventHandler } from '../declared-event-handlers.js';
import { exportedClass, identifier } from '../text-shapes.js';
import type { Project, Rule, SourceFile } from '../types.js';
import { inContext, inLayer, reporter, toViolations, type Finding } from './helpers.js';

const NAME_FIX =
  'Give each consumer its own stable name, `<context>.<what-it-does>`: the processed-event store deduplicates per consumer name, so two consumers sharing one skip the events of each other.';

export const eventsConsumerIdempotent: Rule = {
  id: 'events/consumer-idempotent',
  description: 'Every integration event handler is registered or declared with a stable consumer name, unique in the project, and a processed-event store.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.filter((file) => !file.isTest).flatMap((file) => toViolations(report, file.path, [...flawedRegistrations(file), ...unnamedHandlers(file)]));
  },
  acrossProject(project) {
    const report = reporter(project, this.id);
    const sources = project.files.filter((file) => !file.isTest);
    const firstUse = new Map<string, string>();
    return sources.flatMap((file) => toViolations(report, file.path, [...unregistered(file, project), ...namesTakenElsewhere(file, firstUse)]));
  },
};

/** What one file shows alone: a name used twice, a subscription without a processed-event store. */
function flawedRegistrations(file: SourceFile): Finding[] {
  const withoutStore = consumerRegistrations(file)
    .filter((registration) => !registration.deduplicates)
    .map(({ line }) => {
      const fix = 'Pass `processed` (the processed-event store) and `unitOfWork` in the options, or use consume(definition, { consumer, processed, unitOfWork }, handler): delivery is at least once, so a redelivery must be recognised.';
      return { line, message: 'A consumer is subscribed without a processed-event store.', fix };
    });
  const seen = new Set<string>();
  const repeated = consumerNames(file).flatMap(({ name, line }) => {
    const taken = seen.has(name);
    seen.add(name);
    return taken ? [{ line, message: `The consumer name "${name}" is used twice in this file.`, fix: NAME_FIX }] : [];
  });
  return [...withoutStore, ...repeated].sort((left, right) => left.line - right.line);
}

interface ConsumerName {
  readonly name: string;
  readonly line: number;
}

/** The consumer names a file gives, in a registration or in an `@IntegrationEventHandler` declaration, in source order. */
function consumerNames(file: SourceFile): ConsumerName[] {
  const registered = consumerRegistrations(file).flatMap(({ name, nameLine }) => (name === undefined ? [] : [{ name, line: nameLine }]));
  const declared = declaredEventHandlers(file.scan, 'IntegrationEventHandler').flatMap(({ name }) => (name?.literal === undefined ? [] : [{ name: name.literal, line: name.line }]));
  return [...registered, ...declared].sort((left, right) => left.line - right.line);
}

/** A declared handler carries its consumer name itself: the store deduplicates per name, so it has to be readable where it is declared. */
function unnamedHandlers(file: SourceFile): Finding[] {
  const context = inContext(file.location) ? file.location.context : '<context>';
  return declaredEventHandlers(file.scan, 'IntegrationEventHandler')
    .filter(isUnnamed)
    .map(({ className, line, name }) => ({
      line: name?.line ?? line,
      message: `The consumer name of ${className} is not a string literal.`,
      fix: `Write it in place, @IntegrationEventHandler(<definition>, { consumer: '${context}.<what-it-does>' }, [...]): the processed-event store deduplicates per consumer name, so the name is written once, stable and unique in the project.`,
    }));
}

function isUnnamed({ name }: DeclaredEventHandler): boolean {
  return name?.literal === undefined || name.literal === '';
}

function unregistered(file: SourceFile, project: Project): Finding[] {
  const here = inLayer(file, 'application');
  if (here === undefined || here.inside.slice(0, 2).join('/') !== 'integration/handlers' || !file.path.endsWith('.integration-handler.ts')) return [];
  const handler = exportedClass(file);
  const module = project.files.find(({ location }) => inContext(location) && location.context === here.context && location.layer === 'module');
  // A handler written as a subscription (no class) registers itself; without a module file there is nowhere to look.
  if (handler === undefined || module === undefined || consumerRegistrations(file).length > 0) return [];
  // A handler that declares itself needs no registration: its decorator carries the name.
  if (declaredEventHandlers(file.scan, 'IntegrationEventHandler').length > 0) return [];
  const instance = handler.name.charAt(0).toLowerCase() + handler.name.slice(1);
  const token = handler.name.replace(/(?<=[a-z0-9])(?=[A-Z])/g, '_').toUpperCase();
  const names = [handler.name, instance, token].map(identifier);
  if (consumerRegistrations(module).some(({ code }) => names.some((name) => name.test(code)))) return [];
  return [
    {
      line: handler.line,
      message: `The integration event handler ${handler.name} is not registered with a consumer name in ${module.path}.`,
      fix: `Register it there under a stable name: builder.on(<definition>, { consumer: '${here.context}.<name>' }).handledBy(${handler.name}, [...]), or consume(<definition>, { consumer: '${here.context}.<name>', processed, unitOfWork }, (event) => ${instance}.handle(event)).`,
    },
  ];
}

/** `firstUse` remembers, across the files of the project, where each consumer name was first seen. */
function namesTakenElsewhere(file: SourceFile, firstUse: Map<string, string>): Finding[] {
  return consumerNames(file).flatMap(({ name, line }) => {
    const first = firstUse.get(name);
    if (first === undefined) firstUse.set(name, file.path);
    if (first === undefined || first === file.path) return [];
    return [{ line, message: `The consumer name "${name}" is already used in ${first}.`, fix: NAME_FIX }];
  });
}
