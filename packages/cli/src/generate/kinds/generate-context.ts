import {
  addContextToConfigText,
  CLASSIFICATIONS,
  CONFIG_FILE,
  isOneOf,
  type Config,
  type Upstream,
} from '../../config/index.js';
import { refreshContextDoc } from '../../docs/refresh-context-doc.js';
import { CliError } from '../../cli-error.js';
import { parseContextName, type Name } from '../../naming/index.js';
import type { Workspace } from '../../workspace/index.js';
import type { ContextRequest } from './context-request.js';
import { writeContextFiles } from './write-context-files.js';

/** Shared by `generate context` and `init`, so both create exactly the same context. */
export function generateContext(ws: Workspace, config: Config, request: ContextRequest): Config {
  const context = parseContextName(request.name);
  const classification = knownClassification(context, request.classification);

  assertUpstreamsExist(config, context, request.upstreams);

  const existing = config.contexts[context.kebab];
  const entry = existing ?? { classification, upstreams: request.upstreams, extraDirectories: [], deployable: false };
  const next: Config = { ...config, contexts: { ...config.contexts, [context.kebab]: entry } };

  if (existing === undefined) {
    declareInConfig(ws, context, entry);
  }

  writeContextFiles(ws, { config: next, context, request });

  // An upstream gains a downstream line in its own CONTEXT.md.
  for (const upstream of entry.upstreams) {
    refreshContextDoc(ws, next, upstream.context);
  }

  refreshContextDoc(ws, next, context.kebab);

  return next;
}

function knownClassification(context: Name, classification: string | undefined): string {
  if (isOneOf(CLASSIFICATIONS, classification)) {
    return classification;
  }

  throw new CliError(
    classification === undefined
      ? `The context "${context.kebab}" needs a classification.`
      : `Unknown classification "${classification}".`,
    `Pass --classification with one of: ${CLASSIFICATIONS.join(', ')} (core: what differentiates the business; supporting: needed, not differentiating; generic: buy or keep trivial).`,
  );
}

function assertUpstreamsExist(config: Config, context: Name, upstreams: readonly Upstream[]): void {
  for (const upstream of upstreams) {
    if (upstream.context === context.kebab) {
      throw new CliError(
        `The context "${context.kebab}" cannot be its own upstream.`,
        'Remove the --upstream option naming the context itself.',
      );
    }

    if (config.contexts[upstream.context] === undefined) {
      throw new CliError(
        `The upstream context "${upstream.context}" is not declared.`,
        `Create it first with \`ddd-ts-kit generate context ${upstream.context} --classification <core|supporting|generic>\`.`,
      );
    }
  }
}

function declareInConfig(ws: Workspace, context: Name, entry: Config['contexts'][string]): void {
  const text = ws.read(CONFIG_FILE);

  if (text !== undefined) {
    ws.update(CONFIG_FILE, addContextToConfigText(text, context.kebab, entry));
  }
}
