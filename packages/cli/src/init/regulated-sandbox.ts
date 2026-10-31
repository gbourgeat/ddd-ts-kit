import type { Stack } from '../config';
import { stackSandbox } from './stack-sandbox';

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
 * the settings reference of Claude Code (read on 2026-10-27): the sandbox on, the session failing
 * when it is unavailable, no unsandboxed retry, no command allowed for being sandboxed (the key
 * defaults to `true`, which skips the prompt of a bare `Bash` ask rule for every sandboxed
 * command), the caches the install of the stack writes, the registry, the git host and the hosts
 * of the install scripts of the stack as the only hosts, the credential files and the secret
 * variables denied to every sandboxed command.
 */
export function regulatedSandbox(gitHost: string | undefined, stack: Stack): Record<string, unknown> {
  const install = stackSandbox(stack);

  return {
    enabled: true,
    failIfUnavailable: true,
    allowUnsandboxedCommands: false,
    autoAllowBashIfSandboxed: false,
    filesystem: { allowWrite: install.writes },
    network: {
      allowedDomains: [...new Set([REGISTRY, ...(gitHost === undefined ? [] : [gitHost]), ...install.hosts])],
    },
    credentials: {
      files: CREDENTIAL_FILES.map((file) => ({ path: file, mode: 'deny' })),
      envVars: SECRET_VARIABLES.map((name) => ({ name, mode: 'deny' })),
    },
  };
}
