/**
 * The pipeline jobs `init` writes only when asked (`--ci-extras`, `ci.extras` of the config):
 * each needs a paid plan on a private repository, or only reports in a paid tier. The value is
 * the platform whose pipeline holds it. docs/tools/static-analysis-and-pipeline.md has the table.
 */
export const CI_EXTRAS = {
  codeql: 'github',
  'dependency-review': 'github',
  'gitlab-sast': 'gitlab',
  'gitlab-secret-detection': 'gitlab',
  'gitlab-dependency-scanning': 'gitlab',
} as const;
