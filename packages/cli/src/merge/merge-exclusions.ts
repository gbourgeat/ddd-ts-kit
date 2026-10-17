/** The lockfiles of the package managers a project of the kit can use. */
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];

/**
 * The pathspecs a patch is compared without, to find the commit of the trunk that took a branch
 * in: what a tool writes again on the trunk (the derived files, the migrations, renamed from
 * working ones), the slices and plan files the conductor edits at the merge, the lockfiles.
 * Relative to the project, for a git run from its root.
 */
export function mergeExclusions(contextsDir: string): string[] {
  const left = [
    'openapi/**',
    'clients/**',
    'docs/integration/**',
    'docs/context-map.md',
    '.dependency-cruiser.cjs',
    `${contextsDir}/*/CONTEXT.md`,
    `${contextsDir}/*/*.declarations.ts`,
    `${contextsDir}/*/*.dependencies.ts`,
    'docs/architecture/slices.md',
    'docs/architecture/plan.md',
    '.ddd-ts-kit/**',
    '**/migrations/**',
    ...LOCKFILES.map((file) => `**/${file}`),
  ];

  return ['.', ...left.map((spec) => `:(exclude,glob)${spec}`)];
}
