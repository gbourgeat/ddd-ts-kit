import type { Config } from '../config';

/** What the generated block of `CODEOWNERS` needs to know: who owns each context, who owns the platform, who imports the shared kernel. */
export interface Ownership {
  readonly config: Config;
  /** The contexts with at least one owner, with the contexts that import their published language. */
  readonly contexts: readonly OwnedContext[];
  /** The contexts whose files import the shared kernel. */
  readonly sharedKernelImporters: readonly string[];
}

export interface OwnedContext {
  readonly name: string;
  readonly owners: readonly string[];
  /** The contexts that declare it as an upstream: the consumers of its published language. */
  readonly consumers: readonly string[];
}

/**
 * The lines of the ownership table of the team workflow guide, as a code owners file reads them
 * (GitHub and GitLab: the last matching line wins). Each context's tree to its owners, its
 * published language too, with its consumers named to ask as reviewers; the shared kernel to
 * every context that imports it; the platform, the composition root, the config, the pipeline,
 * the review policy, the guide and the records to the platform owners.
 */
export function codeOwnersLines({ config, contexts, sharedKernelImporters }: Ownership): string[] {
  return [
    ...contexts.flatMap((context) => contextLines(config, context, contexts)),
    ...sharedKernelLines(config, contexts, sharedKernelImporters),
    ...platformLines(config),
  ];
}

function contextLines(config: Config, context: OwnedContext, owned: readonly OwnedContext[]): string[] {
  const tree = `${config.contextsDir}/${context.name}/`;

  const reviewers = context.consumers
    .map((consumer) => {
      const owners = owned.find((candidate) => candidate.name === consumer)?.owners ?? [];

      return owners.length === 0 ? consumer : `${consumer} (${owners.join(' ')})`;
    })
    .join(', ');

  return [
    line(tree, context.owners),
    ...(context.consumers.length === 0
      ? []
      : [`# The consumers of the published language of ${context.name}, to ask as reviewers: ${reviewers}.`]),
    line(`${tree}published-language/`, context.owners),
  ];
}

/** The shared kernel to the owners of every context that imports it; to the platform owners while none does. */
function sharedKernelLines(config: Config, owned: readonly OwnedContext[], importers: readonly string[]): string[] {
  const owners = unique(
    owned.filter((context) => importers.includes(context.name)).flatMap((context) => context.owners),
  );

  const fallback = owners.length === 0 ? config.owners.platform : owners;

  return fallback.length === 0 ? [] : [line(`${config.sharedKernelDir}/`, fallback)];
}

function platformLines(config: Config): string[] {
  const owners = config.owners.platform;

  if (owners.length === 0) {
    return [];
  }

  return [
    `${config.platformDir}/`,
    `${config.sourceRoot}/main.ts`,
    'ddd-ts-kit.config.json',
    ...pipelineFiles(config),
    'REVIEW.md',
    'AGENTS.md',
    'docs/adr/',
  ].map((path) => line(path, owners));
}

/** The files of the pipeline: the git hooks, then the definitions of the platform the stack names. */
function pipelineFiles(config: Config): string[] {
  const { ci } = config.stack;
  const github = ci === 'github' || ci === 'both' ? ['.github/workflows/', '.github/actions/'] : [];
  const gitlab = ci === 'gitlab' || ci === 'both' ? ['.gitlab-ci.yml', '.gitlab/'] : [];

  return ['lefthook.yml', 'commitlint.config.mjs', ...github, ...gitlab];
}

function line(path: string, owners: readonly string[]): string {
  return `${path.padEnd(44)} ${owners.join(' ')}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
