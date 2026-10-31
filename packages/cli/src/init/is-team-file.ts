import type { Config } from '../config';
import { isPipelineDefinition } from './is-pipeline-definition';

/** The journal of drizzle-kit: written empty, then the list of the migrations of the project. Emptied, the next `db:generate` would create every table again. */
const DRIZZLE_JOURNAL = 'migrations/meta/_journal.json';

/**
 * Whether `init` writes this file once and leaves it to the team from then on, `--force` included:
 * the README, the guides of the agents, the entry point and the pipeline definitions, which a team
 * edits from its first day, and the journal of the migrations. The kit cannot tell an edited one
 * from one it wrote, so it never rewrites one that exists.
 */
export function isTeamFile(config: Pick<Config, 'sourceRoot'>, target: string): boolean {
  return (
    ['README.md', 'AGENTS.md', 'CLAUDE.md', `${config.sourceRoot}/main.ts`, DRIZZLE_JOURNAL].includes(target) ||
    isPipelineDefinition(target)
  );
}
