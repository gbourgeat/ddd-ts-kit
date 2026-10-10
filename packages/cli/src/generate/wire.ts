import { routesFile } from '../declared/index.js';
import type { RenderContext } from '../templating/index.js';
import { renderTemplate, templateExists } from '../templating/index.js';
import { applyWiring } from './apply-wiring.js';
import type { Scope } from './scope.js';
import { wiringFamily, type WiringFamily } from './wiring-family.js';

/**
 * Registers a new element where the wiring of the project is written. A kind says what each
 * place receives in `<kind>/<target>.<family>.tpl`; a kind written `<kind>/<variant>` in
 * `<kind>/<variant>.<target>.<family>.tpl`. Targets: `wiring` is the module file of the context
 * (explicit and manual families), `routes` the list of its routes (both styles on tsyringe),
 * `platform` and `platform-test` the two modules of the platform that bind what a declaration
 * cannot say.
 */
export function wire(scope: Scope, kind: string, context: RenderContext): void {
  const base = kind.includes('/') ? `${kind}.` : `${kind}/`;
  const family = wiringFamily(scope.config);

  for (const [target, file] of Object.entries(targetsOf(scope, family))) {
    const template = [family, ...(family === 'manual' ? [] : ['on-tsyringe'])]
      .map((variant) => `${base}${target}.${variant}.tpl`)
      .find(templateExists);

    if (template !== undefined) {
      applyWiring(scope.ws, file, renderTemplate(template, context));
    }
  }
}

function targetsOf(scope: Scope, family: WiringFamily): Record<string, string> {
  const { config, context, dir } = scope;
  const module = `${dir}/${context.kebab}.module.ts`;

  if (family === 'manual') {
    return { wiring: module };
  }

  return {
    ...(family === 'tsyringe' ? { wiring: module } : {}),
    routes: `${dir}/${routesFile(context.kebab)}`,
    platform: `${config.platformDir}/platform.module.ts`,
    'platform-test': `${config.platformDir}/platform-test.module.ts`,
  };
}
