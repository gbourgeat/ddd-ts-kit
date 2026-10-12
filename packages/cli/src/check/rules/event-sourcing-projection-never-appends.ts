import { kernelNames } from '../event-sourcing/kernel-names.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const APPENDING = new Set(['EventStore', 'EventSourcedRepository']);
const DECLARED = /(?<![\w$.])@Projection\s*\(/;

const FIX =
  'A projection reads events and writes its read model through the port of its read model, nothing else: a fact worth keeping is decided by a command, which a policy or a handler of domain events sends.';

export const eventSourcingProjectionNeverAppends: Rule = {
  id: 'event-sourcing/projection-never-appends',
  description:
    'A projection never appends to a stream: it names neither the event store nor a repository of domain/repositories/.',
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
  const repositories = file.imports.flatMap(({ target, names, line }) =>
    target.kind === 'file' &&
    target.location.area === 'context' &&
    target.location.layer === 'domain' &&
    target.location.inside[0] === 'repositories'
      ? names.map((name) => ({ name, line }))
      : [],
  );

  return [...kernelNames(file, APPENDING), ...repositories].map(({ name, line }) => ({
    line,
    message: `The projection names ${name}: it could append to a stream.`,
    fix: FIX,
  }));
}
