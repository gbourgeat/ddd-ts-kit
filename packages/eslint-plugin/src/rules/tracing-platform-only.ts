import type { LintedFile } from '../project/linted-file.js';
import { importListener } from '../support/imports/import-listener.js';
import { inSourceRoot } from '../support/imports/in-source-root.js';
import { defineRule } from '../support/rule/define-rule.js';

const TRACING_PACKAGE = '@ddd-ts-kit/tracing';
const OPEN_TELEMETRY_SCOPE = '@opentelemetry/';

export const tracingPlatformOnly = defineRule<'tracing'>({
  id: 'tracing/platform-only',
  type: 'problem',
  recommended: 'error',
  description: 'Tracing is wired once: `@ddd-ts-kit/tracing` and `@opentelemetry/*` are imported only by the platform directory, `main.ts` and `apps/`.',
  messages: {
    tracing:
      '"{{specifier}}" is imported in {{place}}: tracing is wired once, by the platform. Remove the import: adapters, use cases, events and jobs are observed from outside by `traceApplication()`, given to the kernel module at the composition root; what has to open a span of its own lives in {{platform}}/.',
  },
  create({ file, report }) {
    if (!isJudged(file)) return {};

    return importListener(file, ({ node, specifier, target }) => {
      if (target.kind === 'package' && isTracing(target.name)) report({ node, messageId: 'tracing', data: { specifier, place: placeOf(file), platform: file.config.platformDir } });
    });
  },
});

/** Every source under the source root, tests included, but the platform, `main.ts` and the entry points under `apps/`. */
function isJudged(file: LintedFile): boolean {
  const { area } = file.location;

  return inSourceRoot(file) && area !== 'platform' && area !== 'main' && !file.path.startsWith(`${file.config.sourceRoot}/apps/`);
}

function isTracing(packageName: string): boolean {
  return packageName === TRACING_PACKAGE || packageName.startsWith(OPEN_TELEMETRY_SCOPE);
}

function placeOf({ location, path }: LintedFile): string {
  if (location.area === 'shared-kernel') return 'the shared kernel';
  if (location.area !== 'context') return path;
  if (location.layer === 'module') return `the module file of "${location.context}"`;

  return location.layer === 'root' ? path : `${location.layer}/`;
}
