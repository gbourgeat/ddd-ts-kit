import type { Workspace } from '../workspace';
import { orphanedWiringNotes, type OrphanedWiring } from './orphaned-wiring-notes';
import type { Rewired } from './rewire-contexts';

/**
 * What `--force` says of the wiring: what it kept, then, file by file, what it could not. It says
 * that nothing is lost only when neither a file nor a repository is left to name.
 */
export function wiringNotes(
  ws: Workspace,
  { contexts, repositories }: Rewired,
  orphaned: readonly OrphanedWiring[],
): string[] {
  const named = orphanedWiringNotes(ws, orphaned);

  if (contexts.length === 0) {
    return named;
  }

  const left =
    repositories.length > 0
      ? `The tables of these repositories are wired for the ORM this run left: ${repositories.map((command) => `\`npx ddd-ts-kit ${command}\``).join(', ')} writes each one again.`
      : '';

  const outcome =
    repositories.length === 0 && named.length === 0
      ? 'Nothing the generators wired is lost; `git diff` shows the rest.'
      : 'What it could not keep is named here; `git diff` shows the rest.';

  return [
    `--force rewrote the files of the platform from their templates and kept what the generators and the team wrote in their regions, the grants of the roles and the services of the compose file included. It wired the declared contexts again (${contexts.join(', ')}), and listed again from the tree the tables and the audited events of each one that a region did not hold. ${left === '' ? '' : `${left} `}${outcome}`,
    ...named,
  ];
}
