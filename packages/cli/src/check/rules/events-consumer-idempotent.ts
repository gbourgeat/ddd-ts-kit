import { declaredEventHandlers } from '../declarations/declared-event-handlers';
import { consumerRegistrations } from '../events/consumer-registrations';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inContext } from '../support/in-context';
import { inLayer } from '../support/in-layer';
import { perFile } from '../support/per-file';
import { exportedClass } from '../text/exported-class';
import { identifier } from '../text/identifier';

const NAME_FIX =
  'Give each consumer its own stable name, `<context>.<what-it-does>`: the processed-event store deduplicates per consumer name, so two consumers sharing one skip the events of each other.';

const STORE_FIX =
  'Pass `processed` (the processed-event store) and `unitOfWork` in the options, or use consume(definition, { consumer, processed, unitOfWork }, handler): delivery is at least once, so a redelivery must be recognised.';

const SPREAD_FIX =
  'The options spread an object this file does not show, so `processed` cannot be read. Write `processed` and `unitOfWork` in the options, or spread a `const` of this file that is an object literal carrying `processed`, or a value typed `ConsumeOptions`.';

interface ConsumerName {
  readonly name: string;
  readonly line: number;
}

export const eventsConsumerIdempotent: Rule = {
  id: 'events/consumer-idempotent',
  description:
    'Every integration event handler is registered or declared with a stable consumer name, unique in the project, and a processed-event store.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      file.isTest ? [] : [...flawedRegistrations(file), ...unnamedHandlers(file)],
    );
  },
  acrossProject(project) {
    // Remembers, across the files of the project, where each consumer name was first seen.
    const firstUse = new Map<string, string>();

    return perFile(project, this.id, (file) =>
      file.isTest ? [] : [...unregistered(file, project), ...namesTakenElsewhere(file, firstUse)],
    );
  },
};

/** What one file shows alone: a name used twice, a subscription without a processed-event store. */
function flawedRegistrations(file: SourceFile): Finding[] {
  const withoutStore = consumerRegistrations(file)
    .filter((registration) => !registration.deduplicates)
    .map(({ line, spreadsUnreadable }) => ({
      line,
      message: spreadsUnreadable
        ? 'A consumer is subscribed with options whose processed-event store cannot be read.'
        : 'A consumer is subscribed without a processed-event store.',
      fix: spreadsUnreadable ? SPREAD_FIX : STORE_FIX,
    }));

  const seen = new Set<string>();

  const repeated = consumerNames(file).flatMap(({ name, line }) => {
    const taken = seen.has(name);

    seen.add(name);

    return taken ? [{ line, message: `The consumer name "${name}" is used twice in this file.`, fix: NAME_FIX }] : [];
  });

  return [...withoutStore, ...repeated].sort((left, right) => left.line - right.line);
}

/** The consumer names a file gives, in a registration or in an `@IntegrationEventHandler` declaration, in source order. */
function consumerNames(file: SourceFile): ConsumerName[] {
  const registered = consumerRegistrations(file).flatMap(({ name, nameLine }) =>
    name === undefined ? [] : [{ name, line: nameLine }],
  );

  const declared = declaredEventHandlers(file.scan).flatMap(({ name }) =>
    name?.literal === undefined ? [] : [{ name: name.literal, line: name.line }],
  );

  return [...registered, ...declared].sort((left, right) => left.line - right.line);
}

/** A declared handler carries its consumer name itself: the store deduplicates per name, so it has to be readable where it is declared. */
function unnamedHandlers(file: SourceFile): Finding[] {
  const context = inContext(file.location) ? file.location.context : '<context>';

  return declaredEventHandlers(file.scan)
    .filter(({ name }) => name?.literal === undefined || name.literal === '')
    .map(({ className, line, name }) => ({
      line: name?.line ?? line,
      message: `The consumer name of ${className} is not a string literal.`,
      fix: `Write it in place, @IntegrationEventHandler(<definition>, { consumer: '${context}.<what-it-does>' }, [...]): the processed-event store deduplicates per consumer name, so the name is written once, stable and unique in the project.`,
    }));
}

function unregistered(file: SourceFile, project: Project): Finding[] {
  const here = inLayer(file, 'application');

  if (
    here === undefined ||
    here.inside.slice(0, 2).join('/') !== 'integration/handlers' ||
    !file.path.endsWith('.integration-handler.ts')
  ) {
    return [];
  }

  const handler = exportedClass(file);

  const modules = moduleFilesOf(project, here.context);
  const [module] = modules;

  // A handler written as a subscription (no class) registers itself; without a module file there is nowhere to look.
  if (handler === undefined || module === undefined || consumerRegistrations(file).length > 0) {
    return [];
  }

  // A handler that declares itself needs no registration: its decorator carries the name.
  if (declaredEventHandlers(file.scan).length > 0) {
    return [];
  }

  const instance = handler.name.charAt(0).toLowerCase() + handler.name.slice(1);

  if (modules.some((candidate) => registers(candidate, [handler.name, instance]))) {
    return [];
  }

  return [
    {
      line: handler.line,
      message: `The integration event handler ${handler.name} is not registered with a consumer name in ${module.path}.`,
      fix: `Register it there under a stable name: builder.on(<definition>, { consumer: '${here.context}.<name>' }).handledBy(${handler.name}, [...]), or consume(<definition>, { consumer: '${here.context}.<name>', processed, unitOfWork }, (event) => ${instance}.handle(event)).`,
      subjects: modules.map(({ path }) => path),
    },
  ];
}

function namesTakenElsewhere(file: SourceFile, firstUse: Map<string, string>): Finding[] {
  return consumerNames(file).flatMap(({ name, line }) => {
    const first = firstUse.get(name);

    if (first === undefined) {
      firstUse.set(name, file.path);
    }

    if (first === undefined || first === file.path) {
      return [];
    }

    return [{ line, message: `The consumer name "${name}" is already used in ${first}.`, fix: NAME_FIX }];
  });
}

/** Whether a module file names the handler, by its class or by its instance, in a registration. */
function registers(module: SourceFile, handlerNames: readonly string[]): boolean {
  const names = handlerNames.map(identifier);

  return consumerRegistrations(module).some(({ code }) => names.some((name) => name.test(code)));
}

/** The module file of the context and, in the explicit style, the module file of each module of its model. */
function moduleFilesOf(project: Project, context: string): SourceFile[] {
  return project.files.filter(
    ({ isTest, location }) =>
      !isTest && inContext(location) && location.context === context && location.layer === 'module',
  );
}
