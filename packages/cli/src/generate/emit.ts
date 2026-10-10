import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { renderTemplate, templateExists } from '../templating/index.js';
import { isDeclared } from './is-declared.js';
import type { Scope } from './scope.js';

/** One generated file: the template it comes from and its path inside the context. */
export type Output = readonly [template: string, target: string];

/** Renders templates to paths relative to the context directory. */
export function emit(scope: Scope, context: RenderContext, outputs: readonly Output[]): void {
  for (const [template, target] of outputs) {
    scope.ws.create(`${scope.dir}/${target}`, renderTemplate(styled(scope.config, template), context));
  }
}

/**
 * The template of the style of the project: where a file differs too much between the two
 * styles to share one template, its declared twin sits next to it as `<name>.declared.<ext>.tpl`.
 */
function styled(config: Config, template: string): string {
  if (!isDeclared(config)) return template;

  const twin = template.replace(/((?:\.[a-z]+)?\.tpl)$/, '.declared$1');

  return templateExists(twin) ? twin : template;
}
