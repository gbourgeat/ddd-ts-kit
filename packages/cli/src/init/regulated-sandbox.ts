/** Where npm, pnpm and yarn fetch the packages; the git host of the project is added next to it. */
const REGISTRY = 'registry.npmjs.org';

/** The credential files a sandboxed command may not read: the SSH keys, then the files of the cloud providers. */
const CREDENTIAL_FILES = ['~/.ssh', '~/.aws', '~/.config/gcloud', '~/.azure'];

/** The variables a sandboxed command never sees: the tokens of the git hosts and of npm, the keys of the cloud providers. */
const SECRET_VARIABLES = [
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GITLAB_TOKEN',
  'NPM_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'AZURE_CLIENT_SECRET',
];

/**
 * The `sandbox` block of `.claude/settings.json` of a regulated organisation, with the keys of
 * the settings reference of Claude Code (read on 2026-10-23): the sandbox on, the session failing
 * when it is unavailable, no unsandboxed retry, the registry and the git host as the only hosts,
 * the credential files and the secret variables denied to every sandboxed command.
 */
export function regulatedSandbox(gitHost: string | undefined): Record<string, unknown> {
  return {
    enabled: true,
    failIfUnavailable: true,
    allowUnsandboxedCommands: false,
    network: { allowedDomains: [REGISTRY, ...(gitHost === undefined ? [] : [gitHost])] },
    credentials: {
      files: CREDENTIAL_FILES.map((file) => ({ path: file, mode: 'deny' })),
      envVars: SECRET_VARIABLES.map((name) => ({ name, mode: 'deny' })),
    },
  };
}
