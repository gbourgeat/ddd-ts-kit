import { readTemplate } from './read-template.js';
import { render } from './render.js';
import type { RenderContext } from './render-context.js';

/** Renders a template of the package. Dropped conditional blocks may leave runs of blank lines behind: one is kept, and one final newline. */
export function renderTemplate(name: string, context: RenderContext): string {
  return render(readTemplate(name), context, `templates/${name}`).replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
}
