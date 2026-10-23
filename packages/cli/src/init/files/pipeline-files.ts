import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';
import { when } from './when.js';

const GITHUB: readonly InitFile[] = [
  ['.github/workflows/ci.yml', 'pipeline/github/workflows/ci.yml.tpl'],
  // What every job starts with: Node, then the dependencies, installed once per lockfile and restored after.
  ['.github/actions/setup/action.yml', 'pipeline/github/actions/setup/action.yml.tpl'],
  // The database of the specs, started in a step that retries the pull instead of a service container.
  ['.github/scripts/start-postgres.sh', 'pipeline/github/scripts/start-postgres.sh'],
  ['.github/workflows/pr-title.yml', 'pipeline/github/workflows/pr-title.yml'],
  ['.github/dependabot.yml', 'pipeline/github/dependabot.yml'],
  ['.github/branch-protection.md', 'pipeline/github/branch-protection.md'],
  // The environment of the Copilot cloud agent: Node and the dependencies, before it starts.
  ['.github/workflows/copilot-setup-steps.yml', 'pipeline/github/workflows/copilot-setup-steps.yml'],
];

const GITLAB: readonly InitFile[] = [
  ['.gitlab-ci.yml', 'pipeline/gitlab/gitlab-ci.yml.tpl'],
  ['.gitlab/merge-request-settings.md', 'pipeline/gitlab/merge-request-settings.md'],
];

/** Opt-in (`--ci-extras codeql`): code scanning is free on a public repository and needs GitHub Code Security on a private one. */
const CODEQL: readonly InitFile[] = [['.github/workflows/codeql.yml', 'pipeline/github/workflows/codeql.yml']];

/** Opt-in (`--ci-extras claude-review`): a review of each pull request by Claude Code, a comment that neither approves nor blocks; API tokens on every run. */
const CLAUDE_REVIEW: readonly InitFile[] = [
  ['.github/workflows/claude-review.yml', 'pipeline/github/workflows/claude-review.yml'],
];

/** Opt-in (`--ci-extras claude-triage`): a three-line triage of a failed CI run, read-only, on the job summary and the pull request. */
const CLAUDE_TRIAGE: readonly InitFile[] = [
  ['.github/workflows/claude-triage.yml', 'pipeline/github/workflows/claude-triage.yml'],
];

/** Opt-in (`--ci-extras intent-to-spec`): the headless design pass of the story skill on each intent a merge accepts; API tokens per accepted intent. */
const INTENT_TO_SPEC: readonly InitFile[] = [
  ['.github/workflows/intent-to-spec.yml', 'pipeline/github/workflows/intent-to-spec.yml'],
];

/** The same two jobs for GitLab, in one file `.gitlab-ci.yml` includes; each job written when its extra is asked for. */
const CLAUDE_GITLAB: readonly InitFile[] = [
  ['.gitlab/claude-review.gitlab-ci.yml', 'pipeline/gitlab/claude-review.gitlab-ci.yml.tpl'],
];

/** The pipeline of the chosen platform. Renovate serves both; Dependabot is the GitHub-native alternative. */
export function pipelineFiles(config: Config): InitFile[] {
  const { ci } = config.stack;

  if (ci === 'none') {
    return [];
  }

  return [
    ['renovate.json', 'pipeline/renovate.json'],
    ...when(ci !== 'gitlab', GITHUB),
    ...when(ci !== 'gitlab' && config.ci.extras.includes('codeql'), CODEQL),
    ...when(ci !== 'gitlab' && config.ci.extras.includes('claude-review'), CLAUDE_REVIEW),
    ...when(ci !== 'gitlab' && config.ci.extras.includes('claude-triage'), CLAUDE_TRIAGE),
    ...when(ci !== 'gitlab' && config.ci.extras.includes('intent-to-spec'), INTENT_TO_SPEC),
    ...when(ci !== 'github', GITLAB),
    ...when(ci !== 'github' && hasClaudeExtra(config), CLAUDE_GITLAB),
  ];
}

function hasClaudeExtra(config: Config): boolean {
  return config.ci.extras.includes('claude-review') || config.ci.extras.includes('claude-triage');
}
