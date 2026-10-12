import type { Config } from './config.js';
import { DEFAULT_COMMIT_LIMITS } from './default-commit-limits.js';
import { isReferenceCoverage } from './is-reference-coverage.js';
import { writtenStack } from './written-stack.js';
import { formatJson } from '../json/format-json.js';

/** The config as written to disk: defaults are spelled out so the file documents itself. */
export function serializeConfig(config: Config): string {
  const {
    sourceRoot,
    contextsDir,
    sharedKernelDir,
    platformDir,
    importAlias,
    importExtension,
    rules,
    domainAllowedPackages,
    applicationAllowedPackages,
  } = config;

  const written = {
    sourceRoot,
    contextsDir,
    sharedKernelDir,
    platformDir,
    importAlias,
    importExtension,
    stack: writtenStack(config.stack),
    contexts: writtenContexts(config),
    rules,
    domainAllowedPackages,
    applicationAllowedPackages,
  };

  return formatJson({ ...written, ...optionalKeys(config) });
}

function writtenContexts(config: Config): Record<string, unknown> {
  const contexts = Object.entries(config.contexts).map(([name, context]): [string, unknown] => [
    name,
    {
      classification: context.classification,
      upstreams: context.upstreams,
      ...(context.extraDirectories.length > 0 ? { extraDirectories: context.extraDirectories } : {}),
      ...(context.deployable ? { deployable: true } : {}),
    },
  ]);

  return Object.fromEntries(contexts);
}

function optionalKeys(config: Config): Record<string, unknown> {
  const { deviations, standardInterfaces, onePerFile, worker, commit, coverage } = config;

  const sized =
    commit.maxFiles !== DEFAULT_COMMIT_LIMITS.maxFiles || commit.maxLines !== DEFAULT_COMMIT_LIMITS.maxLines;

  return {
    ...(isReferenceCoverage(coverage) ? {} : { coverage }),
    ...(deviations.length > 0 ? { deviations } : {}),
    ...(Object.keys(standardInterfaces).length > 0 ? { standardInterfaces } : {}),
    ...(onePerFile.allow.length > 0 ? { onePerFile } : {}),
    ...(sized ? { commit } : {}),
    ...(worker ? { worker } : {}),
    ...pipelineKeys(config),
  };
}

/** The extra jobs of the pipeline and the form of the contracts, when they are not the defaults. */
function pipelineKeys({ ci, openapi }: Config): Record<string, unknown> {
  return {
    ...(ci.extras.length > 0 ? { ci } : {}),
    ...(openapi.format !== 'yaml' || openapi.documents.length > 0 ? { openapi } : {}),
  };
}
