import type { Config } from '../config';
import { isPipelineDefinition } from './is-pipeline-definition';

/**
 * Whether `init` writes this file once and leaves it to the team from then on, `--force` included:
 * the README, the guides of the agents, the entry point and the pipeline definitions, which a team
 * edits from its first day. The kit cannot tell an edited one from one it wrote, so it never
 * rewrites one that exists.
 */
export function isTeamFile(config: Pick<Config, 'sourceRoot'>, target: string): boolean {
  return (
    ['README.md', 'AGENTS.md', 'CLAUDE.md', `${config.sourceRoot}/main.ts`].includes(target) ||
    isPipelineDefinition(target)
  );
}
