import type { Config } from '../../config/index.js';
import { routesFile } from '../../declared/index.js';
import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { renderTemplate } from '../../templating/index.js';
import type { Workspace } from '../../workspace/index.js';
import { applyWiring } from '../apply-wiring.js';
import { assembledContext } from '../assembled-context.js';
import { contextVars } from '../context-vars.js';
import { permissionsFile } from '../permissions-file.js';
import { relativeTo } from '../relative-to.js';
import { wiringFamily } from '../wiring-family.js';
import type { ContextRequest } from './context-request.js';
import { importAssembler } from './import-assembler.js';

const GLOSSARY_TODO =
  'TODO(domain): define the ubiquitous language first: one row per term the domain experts use here, with the meaning it has in this context only. Every class, method and event is then named after these terms.';

const PURPOSE_TODO =
  'TODO(domain): say in two sentences which business capability this context owns and for whom; the first sentence is reused in the context map.';

const PROOF = 'test/architecture/extractable.spec.ts';
const COMPOSITION = 'compose-application.ts';

export interface ContextPlan {
  readonly config: Config;
  readonly context: Name;
  readonly request: ContextRequest;
}

/** The files of a new context, the document first: the language is defined before the code that speaks it. */
export function writeContextFiles(ws: Workspace, plan: ContextPlan): void {
  const { config, context } = plan;
  const dir = `${config.contextsDir}/${context.kebab}`;
  const vars = planVars(plan);
  const family = wiringFamily(config);

  ws.create(`${dir}/CONTEXT.md`, renderTemplate('context/CONTEXT.md.tpl', vars));
  writeAssembly(ws, plan, vars);
  ws.create(`${dir}/published-language/index.ts`, renderTemplate('context/published-language-index.ts.tpl', vars));
  registerPermissions(ws, plan, vars);

  if (!ws.exists(PROOF)) {
    ws.create(PROOF, renderTemplate(`architecture/extractable.${family}.spec.ts.tpl`, vars));
  }

  for (const [file, wiring] of [
    [PROOF, `architecture/wiring.${family}.tpl`],
    [`${config.platformDir}/${COMPOSITION}`, `context/wiring.${family}.tpl`],
  ] as const) {
    if (family === 'declared') {
      importAssembler(ws, config, file);
    }

    applyWiring(ws, file, renderTemplate(wiring, vars));
  }
}

function planVars({ config, context, request }: ContextPlan): RenderContext {
  const terms = request.terms ?? [];
  const toContext = (from: string): string => `${relativeTo(from, config.contextsDir)}/${context.kebab}/`;

  return {
    ...contextVars(config, context),
    assembled: {
      module: assembledContext({ config, context }, toContext(config.platformDir)),
      proofModule: assembledContext({ config, context }, toContext('test/architecture')),
    },
    doc: {
      classification: config.contexts[context.kebab]?.classification ?? '',
      purpose: request.purpose?.trim() || PURPOSE_TODO,
      glossaryHint: terms.length > 0 ? '' : `\n${GLOSSARY_TODO}\n`,
      glossaryRows: terms.map((row) => `\n| ${row.term} | ${row.meaning} |  |`).join(''),
    },
  };
}

/**
 * What assembles the context: its module file, or, when its classes declare themselves, nothing
 * (the barrel is derived from the tree at the end of the command). On tsyringe, in both styles,
 * the routes of the context are listed in one file of their own, with the spec that holds the list:
 * no route answers the method and path of another.
 */
function writeAssembly(ws: Workspace, { config, context }: ContextPlan, vars: RenderContext): void {
  const dir = `${config.contextsDir}/${context.kebab}`;
  const family = wiringFamily(config);

  if (family !== 'declared') {
    ws.create(`${dir}/${context.kebab}.module.ts`, renderTemplate(`context/module.${family}.ts.tpl`, vars));
  }

  if (family !== 'manual' && config.stack.http !== 'none') {
    ws.create(`${dir}/${routesFile(context.kebab)}`, renderTemplate('context/routes.ts.tpl', vars));
    ws.create(`${dir}/test/unit/${context.kebab}.routes.spec.ts`, renderTemplate('context/routes.spec.ts.tpl', vars));
  }
}

/**
 * Nothing imports the permissions of a context before its first protected use case, unless a
 * registry lists them: the file is born when it is needed. The models laid out over every
 * permission (relationships, a custom adapter) read them from the registry of the platform.
 */
function registerPermissions(ws: Workspace, { config, context }: ContextPlan, vars: RenderContext): void {
  const registry = `${config.platformDir}/auth/permissions.ts`;

  if (!ws.exists(registry)) {
    return;
  }

  ws.create(
    `${config.contextsDir}/${context.kebab}/${permissionsFile(context)}`,
    renderTemplate('context/permissions.ts.tpl', vars),
  );

  // Until a use case names one of them, only the registry loads the file: its spec holds it from the start.
  ws.create(
    `${config.contextsDir}/${context.kebab}/test/unit/${context.kebab}.permissions.spec.ts`,
    renderTemplate('context/permissions.spec.ts.tpl', vars),
  );

  applyWiring(ws, registry, renderTemplate('context/permission-set.tpl', vars));
}
