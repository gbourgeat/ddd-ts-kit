import { addContextToConfigText, CLASSIFICATIONS, CONFIG_FILE, isOneOf, RELATIONSHIPS, type Config, type Upstream } from '../../config.js';
import { refreshContextDoc } from '../../docs/context-doc.js';
import { CliError } from '../../errors.js';
import { parseContextName, type Name } from '../../naming.js';
import type { RenderContext } from '../../render.js';
import { renderTemplate } from '../../templates.js';
import type { Workspace } from '../../workspace.js';
import { permissionsFile } from '../access.js';
import { applyWiring } from '../emit.js';
import type { Kind } from '../kind.js';
import { parseTerms, type GlossaryRow } from '../language.js';
import { contextVars } from '../scope.js';

export const contextKind: Kind = {
  name: 'context',
  aliases: [],
  usage: 'context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]...',
  summary: 'A bounded context: CONTEXT.md with its glossary, module file, published language, config entry.',
  positionals: ['name'],
  run: ({ ws, config, args, flags }) => {
    generateContext(ws, config, {
      name: args[0] ?? '',
      classification: flags.classification,
      upstreams: flags.upstream.map(parseUpstreamFlag),
      purpose: flags.purpose,
      terms: parseTerms(flags.term),
    });
  },
};

export interface ContextRequest {
  readonly name: string;
  readonly classification: string | undefined;
  readonly upstreams: readonly Upstream[];
  readonly purpose?: string | undefined;
  readonly terms?: readonly GlossaryRow[];
}

/** Shared by `generate context` and `init`, so both create exactly the same context. */
export function generateContext(ws: Workspace, config: Config, request: ContextRequest): Config {
  const context = parseContextName(request.name);
  const classification = knownClassification(context, request.classification);
  assertUpstreamsExist(config, context, request.upstreams);

  const existing = config.contexts[context.kebab];
  const entry = existing ?? { classification, upstreams: request.upstreams, extraDirectories: [], deployable: false };
  const next: Config = { ...config, contexts: { ...config.contexts, [context.kebab]: entry } };
  if (existing === undefined) declareInConfig(ws, context, entry);

  writeContextFiles(ws, { config: next, context, request });
  // An upstream gains a downstream line in its own CONTEXT.md.
  for (const upstream of entry.upstreams) refreshContextDoc(ws, next, upstream.context);
  refreshContextDoc(ws, next, context.kebab);
  return next;
}

function parseUpstreamFlag(value: string): Upstream {
  const [context = '', relationship = 'published-language'] = value.split(':');
  if (!isOneOf(RELATIONSHIPS, relationship)) {
    throw new CliError(`Unknown relationship "${relationship}" in --upstream ${value}.`, `Use one of: ${RELATIONSHIPS.join(', ')}.`);
  }
  return { context: parseContextName(context).kebab, relationship };
}

function knownClassification(context: Name, classification: string | undefined): string {
  if (isOneOf(CLASSIFICATIONS, classification)) return classification;
  throw new CliError(
    classification === undefined ? `The context "${context.kebab}" needs a classification.` : `Unknown classification "${classification}".`,
    `Pass --classification with one of: ${CLASSIFICATIONS.join(', ')} (core: what differentiates the business; supporting: needed, not differentiating; generic: buy or keep trivial).`,
  );
}

function assertUpstreamsExist(config: Config, context: Name, upstreams: readonly Upstream[]): void {
  for (const upstream of upstreams) {
    if (upstream.context === context.kebab) {
      throw new CliError(`The context "${context.kebab}" cannot be its own upstream.`, 'Remove the --upstream option naming the context itself.');
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
  if (text !== undefined) ws.update(CONFIG_FILE, addContextToConfigText(text, context.kebab, entry));
}

const GLOSSARY_TODO = 'TODO(domain): define the ubiquitous language first: one row per term the domain experts use here, with the meaning it has in this context only. Every class, method and event is then named after these terms.';
const PURPOSE_TODO = 'TODO(domain): say in two sentences which business capability this context owns and for whom; the first sentence is reused in the context map.';

function writeContextFiles(ws: Workspace, plan: { config: Config; context: Name; request: ContextRequest }): void {
  const { config, context, request } = plan;
  const dir = `${config.contextsDir}/${context.kebab}`;
  const terms = request.terms ?? [];
  const base = contextVars(config, context);
  const vars = {
    ...base,
    doc: {
      classification: config.contexts[context.kebab]?.classification ?? '',
      purpose: request.purpose?.trim() || PURPOSE_TODO,
      glossaryHint: terms.length > 0 ? '' : `\n${GLOSSARY_TODO}\n`,
      glossaryRows: terms.map((row) => `\n| ${row.term} | ${row.meaning} |  |`).join(''),
    },
  };
  // The document comes first: the language is defined before the code that speaks it.
  ws.create(`${dir}/CONTEXT.md`, renderTemplate('context/CONTEXT.md.tpl', vars));
  // A Nest application hosts the same hand-wired contexts: the two stacks share their templates.
  const family = config.stack.di === 'tsyringe' ? 'tsyringe' : 'manual';
  ws.create(`${dir}/${context.kebab}.module.ts`, renderTemplate(`context/module.${family}.ts.tpl`, vars));
  ws.create(`${dir}/published-language/index.ts`, renderTemplate('context/published-language-index.ts.tpl', vars));
  ws.create(`${dir}/${permissionsFile(context)}`, renderTemplate('context/permissions.ts.tpl', vars));
  registerPermissions(ws, config, vars);
  const proof = 'test/architecture/extractable.spec.ts';
  if (!ws.exists(proof)) ws.create(proof, renderTemplate(`architecture/extractable.${family}.spec.ts.tpl`, vars));
  applyWiring(ws, proof, renderTemplate(`architecture/wiring.${family}.tpl`, vars));
  applyWiring(ws, `${config.platformDir}/application.ts`, renderTemplate(`context/wiring.${family}.tpl`, vars));
}

/** The models laid out over every permission (relationships, a custom adapter) read them from the registry of the platform. */
function registerPermissions(ws: Workspace, config: Config, vars: RenderContext): void {
  const registry = `${config.platformDir}/auth/permissions.ts`;
  if (ws.exists(registry)) applyWiring(ws, registry, renderTemplate('context/permission-set.tpl', vars));
}
