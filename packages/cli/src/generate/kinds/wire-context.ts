import { posix } from 'node:path';
import { renderTemplate } from '../../templating/index.js';
import type { Workspace } from '../../workspace/index.js';
import { applyWiring } from '../apply-wiring.js';
import { permissionsFile } from '../permissions-file.js';
import { wiringFamily } from '../wiring-family.js';
import type { ContextPlan } from './context-plan.js';
import { importAssembler } from './import-assembler.js';
import { planVars } from './plan-vars.js';
import { platformFileIn } from '../../platform-layout/index.js';

const PROOF = 'test/architecture/extractable.spec.ts';

/**
 * What the shared files of the project say of one context: the composition root assembles it,
 * the proof that each context wires alone lists it, and the registry of permissions holds its
 * set once the context has one. Applied when the context is created, and again when
 * `init --force` rewrote those files: a wiring that is already there is left as it is.
 */
export function wireContext(ws: Workspace, plan: ContextPlan): void {
  const { config, context } = plan;
  const composition = platformFileIn(config, 'composition/compose-application.ts', (path) => ws.exists(path));
  const vars = planVars(plan, posix.dirname(composition));
  const family = wiringFamily(config);
  const registry = platformFileIn(config, 'auth/authorization/permissions.ts', (path) => ws.exists(path));

  if (!ws.exists(PROOF)) {
    ws.create(PROOF, renderTemplate(`architecture/extractable.${family}.spec.ts.tpl`, vars));
  }

  for (const [file, wiring] of [
    [PROOF, `architecture/wiring.${family}.tpl`],
    [composition, `context/wiring.${family}.tpl`],
  ] as const) {
    if (family === 'declared') {
      importAssembler(ws, config, file);
    }

    applyWiring(ws, file, renderTemplate(wiring, vars));
  }

  if (ws.exists(registry) && ws.exists(`${config.contextsDir}/${context.kebab}/${permissionsFile(context)}`)) {
    applyWiring(ws, registry, renderTemplate('context/permission-set.tpl', vars));
  }
}
