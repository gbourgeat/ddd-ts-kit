import { fitSource } from '../layout';
import { readTemplate } from './read-template';
import { render } from './render';
import type { RenderContext } from './render-context';

/** Renders a template of the package. Dropped conditional blocks may leave runs of blank lines behind: one is kept, and one final newline. */
export function renderTemplate(name: string, context: RenderContext): string {
  const rendered = render(readTemplate(name), context, `templates/${name}`)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '\n');

  // The names of the project decide which lines of a source file fit: they are laid out once known.
  return name.endsWith('.ts.tpl') ? fitSource(rendered) : rendered;
}
