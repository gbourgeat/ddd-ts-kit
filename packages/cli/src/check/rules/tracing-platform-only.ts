import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { isUnder } from '../project/is-under.js';
import { perFile } from '../support/per-file.js';

const TRACING_PACKAGE = '@ddd-ts-kit/tracing';
const OPEN_TELEMETRY_SCOPE = '@opentelemetry/';

export const tracingPlatformOnly: Rule = {
  id: 'tracing/platform-only',
  description: 'Tracing is wired once: @ddd-ts-kit/tracing and @opentelemetry/* are imported only by the platform directory, main.ts and apps/.',
  scope: 'file',
  run(project) {
    const { platformDir } = project.config;
    const fix = `Remove the import: adapters are wrapped by the \`decorate\` hook of the composition root and use cases by a bus middleware; what has to open a span of its own lives in ${platformDir}/.`;

    return perFile(project, this.id, (file) => {
      if (!isJudged(file, project)) return [];

      return file.imports
        .filter(({ target }) => target.kind === 'package' && isTracing(target.name))
        .map(({ line, specifier }) => ({ line, message: `"${specifier}" is imported in ${placeOf(file)}: tracing is wired once, by the platform.`, fix }));
    });
  },
};

/** Every source under the source root, tests included, but the platform, `main.ts` and the entry points under `apps/`. */
function isJudged({ location, path }: SourceFile, { config }: Project): boolean {
  const isWiring = location.area === 'platform' || location.area === 'main' || isUnder(path, `${config.sourceRoot}/apps`);

  return path.startsWith(`${config.sourceRoot}/`) && !isWiring;
}

function isTracing(packageName: string): boolean {
  return packageName === TRACING_PACKAGE || packageName.startsWith(OPEN_TELEMETRY_SCOPE);
}

function placeOf({ location, path }: SourceFile): string {
  if (location.area === 'shared-kernel') return 'the shared kernel';
  if (location.area !== 'context') return path;
  if (location.layer === 'module') return `the module file of "${location.context}"`;

  return location.layer === 'root' ? path : `${location.layer}/`;
}
