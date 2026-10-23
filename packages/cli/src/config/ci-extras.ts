/**
 * The pipeline jobs `init` writes only when asked (`--ci-extras`, `ci.extras` of the config):
 * each needs a paid plan on a private repository, only reports in a paid tier, or spends API
 * tokens on every run. The value is the platform whose pipeline holds it, `any` for a job written
 * for both. docs/tools/static-analysis-and-pipeline.md has the table.
 */
export const CI_EXTRAS = {
  codeql: 'github',
  'dependency-review': 'github',
  'gitlab-sast': 'gitlab',
  'gitlab-secret-detection': 'gitlab',
  'gitlab-dependency-scanning': 'gitlab',
  'claude-review': 'any',
  'claude-triage': 'any',
  'intent-to-spec': 'github',
} as const;
