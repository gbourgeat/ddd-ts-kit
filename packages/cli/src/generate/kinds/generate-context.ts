import {
  addContextToConfigText,
  CLASSIFICATIONS,
  CONFIG_FILE,
  isOneOf,
  type Config,
  type Upstream,
} from '../../config';
import { refreshContextDoc } from '../../docs/refresh-context-doc';
import { CliError } from '../../cli-error';
import { parseContextName, type Name } from '../../naming';
import { PRISMA_MAIN_SCHEMA, prismaSchemaOf } from '../../prisma-schema';
import type { Workspace } from '../../workspace';
import type { ContextRequest } from './context-request';
import { declareContextEntries } from './declare-context-entries';
import { writeContextFiles } from './write-context-files';

/** Shared by `generate context` and `init`, so both create exactly the same context. */
export function generateContext(ws: Workspace, config: Config, request: ContextRequest): Config {
  const context = parseContextName(request.name);

  refuseReservedName(context);

  const classification = knownClassification(context, request.classification);

  assertUpstreamsExist(config, context, request.upstreams);

  const existing = config.contexts[context.kebab];

  const entry = existing ?? {
    classification,
    upstreams: request.upstreams,
    extraDirectories: [],
    modules: [],
    deployable: false,
    owners: [],
  };

  const next: Config = { ...config, contexts: { ...config.contexts, [context.kebab]: entry } };

  if (existing === undefined) {
    declareInConfig(ws, context, entry);
  }

  writeContextFiles(ws, { config: next, context, request });
  declareContextEntries(ws, next);

  // An upstream gains a downstream line in its own CONTEXT.md.
  for (const upstream of entry.upstreams) {
    refreshContextDoc(ws, next, upstream.context);
  }

  refreshContextDoc(ws, next, context.kebab);

  return next;
}

/**
 * The models of a context on Prisma live in `prisma/schema/<context>.prisma`, beside the main file
 * `prisma/schema/schema.prisma`: a context named `schema` would write its models into the main
 * file, and the guard reads that file as no context's. Refused on every ORM: `init --force`
 * changes the ORM of a project, and the word names the storage, not a capability of the business.
 */
function refuseReservedName(context: Name): void {
  if (prismaSchemaOf(context.kebab) !== PRISMA_MAIN_SCHEMA) {
    return;
  }

  throw new CliError(
    `"${context.kebab}" cannot name a bounded context: on Prisma the models of a context live in ${prismaSchemaOf('<context>')}, and ${PRISMA_MAIN_SCHEMA} is the main file of the schema (the generator, the datasource, the tables of the platform), shared by every context.`,
    'Name the context after the business capability it serves, for example billing or order-fulfilment. The name is refused on every ORM, since `init --force` can move a project to Prisma.',
  );
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
