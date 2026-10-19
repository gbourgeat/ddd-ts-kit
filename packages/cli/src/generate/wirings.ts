import { routesFile } from '../declared/index.js';
import type { RenderContext } from '../templating/index.js';
import { renderTemplate, templateExists } from '../templating/index.js';
import type { Scope } from './scope.js';
import { wiringFamily, type WiringFamily } from './wiring-family.js';
import { platformPath } from './platform-path.js';

/** What `wire` adds, file by file, without adding it. */
export function wirings(scope: Scope, kind: string, context: RenderContext): { file: string; wiring: string }[] {
  const base = kind.includes('/') ? `${kind}.` : `${kind}/`;
  const family = wiringFamily(scope.config);

  return Object.entries(targetsOf(scope, family)).flatMap(([target, file]) => {
    const template = [family, ...(family === 'manual' ? [] : ['on-tsyringe'])]
      .map((variant) => `${base}${target}.${variant}.tpl`)
      .find(templateExists);

    return template === undefined ? [] : [{ file, wiring: renderTemplate(template, context) }];
  });
}

function targetsOf(scope: Scope, family: WiringFamily): Record<string, string> {
  const { context, dir } = scope;
  const module = `${dir}/${context.kebab}.module.ts`;

  if (family === 'manual') {
    return { wiring: module };
  }

  return {
    ...(family === 'tsyringe' ? { wiring: module } : {}),
    routes: `${dir}/${routesFile(context.kebab)}`,
    platform: platformPath(scope, 'composition/platform.module.ts'),
    'platform-test': platformPath(scope, 'composition/platform-test.module.ts'),
  };
}
