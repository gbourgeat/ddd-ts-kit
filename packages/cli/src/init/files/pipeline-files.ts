import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';
import { when } from './when.js';

const GITHUB: readonly InitFile[] = [
  ['.github/workflows/ci.yml', 'pipeline/github/workflows/ci.yml'],
  ['.github/workflows/codeql.yml', 'pipeline/github/workflows/codeql.yml'],
  ['.github/workflows/pr-title.yml', 'pipeline/github/workflows/pr-title.yml'],
  ['.github/dependabot.yml', 'pipeline/github/dependabot.yml'],
  ['.github/branch-protection.md', 'pipeline/github/branch-protection.md'],
];

const GITLAB: readonly InitFile[] = [
  ['.gitlab-ci.yml', 'pipeline/gitlab/gitlab-ci.yml'],
  ['.gitlab/merge-request-settings.md', 'pipeline/gitlab/merge-request-settings.md'],
];

/** The pipeline of the chosen platform. Renovate serves both; Dependabot is the GitHub-native alternative. */
export function pipelineFiles(config: Config): InitFile[] {
  const { ci } = config.stack;

  if (ci === 'none') return [];

  return [['renovate.json', 'pipeline/renovate.json'], ...when(ci !== 'gitlab', GITHUB), ...when(ci !== 'github', GITLAB)];
}
