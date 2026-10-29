import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { codeOwnersLines, type OwnedContext } from './code-owners-lines';
import type { ContextFacts } from './context-facts';
import { sharedKernelImporters } from './shared-kernel-importers';
import { ownEntry } from '../config/values/own-entry';

/** At the root, where GitHub and GitLab both read it. */
const CODE_OWNERS = 'CODEOWNERS';
const REGION = 'code-owners';
const OPEN = `# ddd-ts-kit:${REGION}`;
const CLOSE = `# /ddd-ts-kit:${REGION}`;

const HEADER = [
  '# Code owners, from the owners of ddd-ts-kit.config.json: `contexts.<name>.owners` and `owners.platform`.',
  '# Written by `npx ddd-ts-kit docs` between the markers; what is outside them is yours. The last matching line wins.',
];

/**
 * The code owners file of the project, once at least one owner is configured: the generated
 * block between its markers, written by `docs` and judged stale by `docs --check`. A file the
 * team wrote by hand gets the block appended, so that its lines come last and win; without any
 * owner nothing is written, and a file written before is left as it is.
 */
export function writeCodeOwners(ws: Workspace, config: Config, contexts: readonly ContextFacts[]): void {
  const owned = ownedContexts(config, contexts);

  if (owned.length === 0 && config.owners.platform.length === 0) {
    return;
  }

  const importers = sharedKernelImporters(
    ws,
    config,
    contexts.map((context) => context.name),
  );

  const lines = codeOwnersLines({ config, contexts: owned, sharedKernelImporters: importers });
  const existing = ws.read(CODE_OWNERS);

  if (existing === undefined) {
    ws.create(CODE_OWNERS, `${[...HEADER, OPEN, ...lines, CLOSE].join('\n')}\n`);

    return;
  }

  ws.update(CODE_OWNERS, withBlock(existing, lines));
}

function ownedContexts(config: Config, contexts: readonly ContextFacts[]): OwnedContext[] {
  return contexts
    .filter((context) => (ownEntry(config.contexts, context.name)?.owners ?? []).length > 0)
    .map((context) => ({
      name: context.name,
      owners: ownEntry(config.contexts, context.name)?.owners ?? [],
      consumers: context.downstreams.map((downstream) => downstream.context),
    }));
}

/** The block replaced between its markers, or appended after what the team wrote. */
function withBlock(existing: string, lines: readonly string[]): string {
  const all = existing.split('\n');
  const open = all.indexOf(OPEN);
  const close = all.indexOf(CLOSE, open + 1);

  if (open === -1 || close === -1) {
    const kept = existing.endsWith('\n') || existing === '' ? existing : `${existing}\n`;

    return `${kept}${kept === '' ? '' : '\n'}${[...HEADER, OPEN, ...lines, CLOSE].join('\n')}\n`;
  }

  all.splice(open + 1, close - open - 1, ...lines);

  return all.join('\n');
}
