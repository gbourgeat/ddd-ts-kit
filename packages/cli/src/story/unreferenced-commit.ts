/**
 * A commit of the story, on the current branch, that changes a migration or a container file and
 * carries no `Change: <id>` trailer: what reached production otherwise than through the code,
 * without the reference the change process of the team gives.
 */
export interface UnreferencedCommit {
  /** The abbreviated hash. */
  readonly sha: string;
  readonly subject: string;
  /** The migration and container files it changes, relative to the project root. */
  readonly files: readonly string[];
  /** The rows of the story it belongs to (its `Slice:` trailer, else those its message names); empty when its subject names the story alone. */
  readonly rows: readonly string[];
  /** What settles it. */
  readonly fix: string;
}
