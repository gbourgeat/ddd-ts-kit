import { routesFile } from '../declared';
import { declaredModule, moduleFileOf, treeOf, wiringFilesOf } from '../model-modules';
import type { RenderContext } from '../templating';
import { renderTemplate, templateExists } from '../templating';
import type { Registration } from './registration';
import type { Scope } from './scope';
import { wiringFamily, type WiringFamily } from './wiring-family';
import { platformPath } from './platform-path';

/** What `wire` adds, file by file, without adding it. */
export function wirings(
  scope: Scope,
  { kind, holding }: Registration,
  context: RenderContext,
): { file: string; wiring: string }[] {
  const base = kind.includes('/') ? `${kind}.` : `${kind}/`;
  const family = wiringFamily(scope.config);

  return Object.entries(targetsOf(scope, family, holding)).flatMap(([target, file]) => {
    const template = [family, ...(family === 'manual' ? [] : ['on-container'])]
      .map((variant) => `${base}${target}.${variant}.tpl`)
      .find(templateExists);

    return template === undefined ? [] : [{ file, wiring: renderTemplate(template, context) }];
  });
}

function targetsOf(scope: Scope, family: WiringFamily, holding: string | undefined): Record<string, string> {
  const { context, dir } = scope;
  const module = moduleFileFor(scope, holding);

  if (family === 'manual') {
    return { wiring: module };
  }

  return {
    ...(family === 'container' ? { wiring: module } : {}),
    routes: `${dir}/${routesFile(context.kebab)}`,
    platform: platformPath(scope, 'composition/platform.module.ts'),
    'platform-test': platformPath(scope, 'composition/platform-test.module.ts'),
  };
}

/**
 * The module file a registration is written in: the one that holds the line it needs, else the
 * module file of the module of the model `--module` names, when the context has one
 * (`<module>/<module>.module.ts`, composed by the module file of the context), else the module
 * file of the context.
 */
function moduleFileFor(scope: Scope, holding: string | undefined): string {
  const { config, context, dir, flags, ws } = scope;
  const own = `${dir}/${context.kebab}.module.ts`;

  const holder =
    holding === undefined
      ? undefined
      : wiringFilesOf(treeOf(config, context.kebab), context.kebab).find((file) => ws.read(file)?.includes(holding));

  if (holder !== undefined) {
    return holder;
  }

  const asked =
    flags.module === undefined
      ? undefined
      : `${dir}/${moduleFileOf(declaredModule(config, context.kebab, flags.module))}`;

  return asked !== undefined && ws.exists(asked) ? asked : own;
}
