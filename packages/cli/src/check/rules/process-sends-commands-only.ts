import type { Finding } from '../model/finding.js';
import type { Location } from '../model/location.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const WRITERS: Readonly<Record<string, readonly string[]>> = {
  domain: ['aggregates', 'entities', 'repositories', 'services'],
  application: ['ports'],
};

const FIX =
  'Remove the import and add the command that does the work to the decision of the step: a process never writes an aggregate nor calls an outside system, the handler of each command does, authorized and transactional.';

export const processSendsCommandsOnly: Rule = {
  id: 'process/sends-commands-only',
  description:
    'A process manager of application/processes/*.process.ts changes the world only through the commands it decides: it imports no aggregate, entity, repository, domain service, port or infrastructure, of its context or another.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => (isProcessFile(file) ? writers(file) : []));
  },
};

function isProcessFile(file: SourceFile): boolean {
  const { location } = file;

  return (
    !file.isTest &&
    location.area === 'context' &&
    location.layer === 'application' &&
    location.inside[0] === 'processes' &&
    file.path.endsWith('.process.ts')
  );
}

function writers(file: SourceFile): Finding[] {
  return file.imports.flatMap(({ target, line }) => {
    const reached = target.kind === 'file' ? writerOf(target.location) : undefined;

    return reached === undefined ? [] : [{ line, message: `The process imports ${reached}.`, fix: FIX }];
  });
}

function writerOf(location: Location): string | undefined {
  if (location.area !== 'context') {
    return undefined;
  }

  if (location.layer === 'infrastructure') {
    return 'infrastructure/';
  }

  const [folder = ''] = location.inside;

  return WRITERS[location.layer]?.includes(folder) === true ? `${location.layer}/${folder}/` : undefined;
}
