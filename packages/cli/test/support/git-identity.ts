/** Who the commits a test makes through the CLI are made by, as git reads it from the environment. */
const IDENTITY = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
} as const;

/**
 * Gives the git that the CLI runs in process an identity, for the specs whose command commits
 * (merge-trunk): a runner of the pipeline configures none, and git then refuses the commit.
 * What the machine already sets is kept.
 */
export function withGitIdentity(): void {
  for (const [key, value] of Object.entries(IDENTITY)) {
    process.env[key] ??= value;
  }
}

/** The names of the variables {@link withGitIdentity} sets. */
export const IDENTITY_VARIABLES = Object.keys(IDENTITY);
