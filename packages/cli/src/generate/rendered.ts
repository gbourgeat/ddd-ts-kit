import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { renderTemplate, templateExists } from '../templating';
import { isDeclared } from './is-declared';
import type { Scope } from './scope';

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
