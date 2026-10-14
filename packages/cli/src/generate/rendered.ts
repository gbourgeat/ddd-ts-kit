import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { renderTemplate, templateExists } from '../templating/index.js';
import { isDeclared } from './is-declared.js';
import type { Scope } from './scope.js';

/** What `emit` writes for one template, in the style of the project, without writing it. */
export function rendered(scope: Scope, template: string, context: RenderContext): string {
  return renderTemplate(styled(scope.config, template), context);
}

/**
 * The template of the style of the project: where a file differs too much between the two
 * styles to share one template, its declared twin sits next to it as `<name>.declared.<ext>.tpl`.
 */
function styled(config: Config, template: string): string {
  if (!isDeclared(config)) {
    return template;
  }

  const twin = template.replace(/((?:\.[a-z]+)?\.tpl)$/, '.declared$1');

  return templateExists(twin) ? twin : template;
}
