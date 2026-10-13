import { kernelNames, type NamedImport } from '../event-sourcing/kernel-names.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { callArguments } from '../text/call-arguments.js';
import type { ListPart } from '../text/list-part.js';
import { perFile } from '../support/per-file.js';

const APPENDING = new Set(['EventStore', 'EventSourcedRepository']);
const DECLARED = /(?<![\w$.])@Projection\s*\(/;
const DECLARED_CALLS = new RegExp(DECLARED.source, 'g');

const FIX =
  'A projection reads events and writes its read model through the port of its read model, nothing else: a fact worth keeping is decided by a command, which a policy or a handler of domain events sends.';

export const eventSourcingProjectionNeverAppends: Rule = {
  id: 'event-sourcing/projection-never-appends',
  description:
    'A projection never appends to a stream: it names no event store, and a projection fed by the event store names no repository of domain/repositories/ either.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => (isProjection(file) ? appending(file) : []));
  },
};

function isProjection(file: SourceFile): boolean {
  const { location } = file;

  if (location.area !== 'context' || file.isTest) {
    return false;
  }

  return (location.layer === 'application' && location.inside[0] === 'projections') || DECLARED.test(file.scan.code);
}

function appending(file: SourceFile): Finding[] {
  const repositories = isStoreFed(file) ? repositoriesOf(file) : [];

  return [...kernelNames(file, APPENDING), ...repositories].map(({ name, line }) => ({
    line,
    message: `The projection names ${name}: it could append to a stream.`,
    fix: FIX,
  }));
}

/** Declared `@Projection(name, { feed: 'event-store' })`: replayed from position zero at every rebuild. */
function isStoreFed(file: SourceFile): boolean {
  const { code } = file.scan;

  return [...code.matchAll(DECLARED_CALLS)].some((match) => {
    const options = callArguments(code, match.index + match[0].length - 1)[1];

    return options !== undefined && feedsFromStore(file, options);
  });
}

function feedsFromStore({ scan }: SourceFile, options: ListPart): boolean {
  const end = options.start + options.code.length;

  return scan.strings.some(
    (literal) =>
      literal.start >= options.start &&
      literal.end <= end &&
      literal.value === 'event-store' &&
      /\bfeed\s*:\s*$/.test(scan.code.slice(options.start, literal.start)),
  );
}

function repositoriesOf(file: SourceFile): NamedImport[] {
  return file.imports.flatMap(({ target, names, line }) =>
    target.kind === 'file' &&
    target.location.area === 'context' &&
    target.location.layer === 'domain' &&
    target.location.inside[0] === 'repositories'
      ? names.map((name) => ({ name, line }))
      : [],
  );
}
