import { routesFile } from '../../declared/index.js';
import type { RenderContext } from '../../templating/index.js';
import { renderTemplate } from '../../templating/index.js';
import type { Workspace } from '../../workspace/index.js';
import { listsRoutes } from '../lists-routes.js';
import { permissionsFile } from '../permissions-file.js';
import { wiringFamily } from '../wiring-family.js';
import type { ContextPlan } from './context-plan.js';
import { planVars } from './plan-vars.js';
import { wireContext } from './wire-context.js';
import { platformFileIn } from '../../platform-layout/index.js';

/** The files of a new context, the document first: the language is defined before the code that speaks it. */
export function writeContextFiles(ws: Workspace, plan: ContextPlan): void {
  const { config, context } = plan;
  const dir = `${config.contextsDir}/${context.kebab}`;
  const vars = planVars(plan);

  ws.create(`${dir}/CONTEXT.md`, renderTemplate('context/CONTEXT.md.tpl', vars));
  writeAssembly(ws, plan, vars);
  ws.create(`${dir}/published-language/index.ts`, renderTemplate('context/published-language-index.ts.tpl', vars));
  registerPermissions(ws, plan, vars);
  wireContext(ws, plan);
}

/**
 * What assembles the context: its module file, or, when its classes declare themselves, nothing
 * (the barrel is derived from the tree at the end of the command). On tsyringe the routes of the
 * context are listed in one file of their own, with the spec that holds the list: no route answers
 * the method and path of another. Declared controllers need no list: each one is its own registration.
 */
function writeAssembly(ws: Workspace, { config, context }: ContextPlan, vars: RenderContext): void {
  const dir = `${config.contextsDir}/${context.kebab}`;
  const family = wiringFamily(config);

  if (family !== 'declared') {
    ws.create(`${dir}/${context.kebab}.module.ts`, renderTemplate(`context/module.${family}.ts.tpl`, vars));
  }

  if (family !== 'manual' && listsRoutes(config)) {
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
  const registry = platformFileIn(config, 'auth/authorization/permissions.ts', (path) => ws.exists(path));

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
}
