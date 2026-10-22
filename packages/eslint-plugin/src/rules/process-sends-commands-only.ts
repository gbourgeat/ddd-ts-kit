import type { ImportTarget } from '../project/resolve-import';
import type { LintedFile } from '../project/linted-file';
import { defineRule } from '../support/rule/define-rule';
import { importListener } from '../support/imports/import-listener';

type MessageId = 'writes';

const WRITERS: Readonly<Record<string, readonly string[]>> = {
  domain: ['aggregates', 'entities', 'repositories', 'services'],
  application: ['ports'],
};

export const processSendsCommandsOnly = defineRule<MessageId>({
  id: 'process/sends-commands-only',
  type: 'problem',
  recommended: 'error',
  description:
    'A process manager of application/processes decides from its state and what happened, and changes the world only through the commands it sends: it imports no aggregate, entity, repository, domain service, port or infrastructure.',
  messages: {
    writes:
      'This process imports {{target}}. A process never writes an aggregate, of its context or another, nor calls an outside system: it answers a decision whose commands do it, each authorized and transactional in its own handler. Remove the import and send a command instead.',
  },
  create({ file, report }) {
    if (!isProcessFile(file)) {
      return {};
    }

    return importListener(file, ({ node, target }) => {
      const reached = reachedWriter(target);

      if (reached !== undefined) {
        report({ node, messageId: 'writes', data: { target: reached } });
      }
    });
  },
});

function isProcessFile(file: LintedFile): boolean {
  const { location } = file;

  return (
    !file.isTest &&
    location.area === 'context' &&
    location.layer === 'application' &&
    location.inside[0] === 'processes' &&
    file.path.endsWith('.process.ts')
  );
}

function reachedWriter(target: ImportTarget): string | undefined {
  if (target.kind !== 'file' || target.location.area !== 'context') {
    return undefined;
  }

  const { layer, inside } = target.location;

  if (layer === 'infrastructure') {
    return 'infrastructure/';
  }

  const [folder = ''] = inside;

  return WRITERS[layer]?.includes(folder) === true ? `${layer}/${folder}/` : undefined;
}
