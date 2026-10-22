import type { CommitLimits } from './commit-limits';

/** The `commit` key of the config: the advised size of one commit, and what a commit made by an agent says of itself. */
export interface CommitConfig extends CommitLimits {
  /**
   * True when a commit made by an agent of the plugin carries the trailer
   * `Agent: <host> ddd-ts-kit@<plugin version> <agent name>`: the story skill, the context-builder
   * and the fix skill write it, and the report of a story counts the commits made by an agent
   * against those made by hand. False by default: many teams refuse attribution lines in commits.
   */
  readonly agentTrailer: boolean;
}
