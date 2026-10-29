/** A definition of the pipeline `init` writes: a GitHub workflow, `.gitlab-ci.yml` or a file it includes. */
export function isPipelineDefinition(target: string): boolean {
  return (
    target === '.gitlab-ci.yml' ||
    target.startsWith('.github/workflows/') ||
    (target.startsWith('.gitlab/') && target.endsWith('.gitlab-ci.yml'))
  );
}
