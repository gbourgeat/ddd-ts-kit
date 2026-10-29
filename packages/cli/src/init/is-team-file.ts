import type { Config } from '../config';

/**
 * Whether `init` writes this file once and leaves it to the team from then on, `--force` included:
 * the README, the guides of the agents, the entry point and the pipeline definitions, which a team
 * edits from its first day. The kit cannot tell an edited one from one it wrote, so it never
 * rewrites one that exists.
 */
export function isTeamFile(config: Pick<Config, 'sourceRoot'>, target: string): boolean {
  return (
    ['README.md', 'AGENTS.md', 'CLAUDE.md', `${config.sourceRoot}/main.ts`, '.gitlab-ci.yml'].includes(target) ||
    target.startsWith('.github/workflows/') ||
    (target.startsWith('.gitlab/') && target.endsWith('.gitlab-ci.yml'))
  );
}
