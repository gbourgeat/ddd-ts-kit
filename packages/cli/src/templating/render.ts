import type { RenderContext } from './render-context';
import { Rendering } from './rendering';

/** `${{ ... }}` is an expression of a GitHub workflow, never a tag of a template. */
const TAG = /(?<!\$)\{\{\s*(#if|#unless|\/if|\/unless)?\s*([A-Za-z0-9_.]*)\s*\}\}/g;
/** A block tag alone on its line leaves no blank line behind. */
const STANDALONE_BLOCK_TAG = /^[ \t]*(\{\{\s*[#/](?:if|unless)[^}\n]*\}\})[ \t]*\r?\n/gm;

/** Fills the placeholders of a template and keeps the blocks whose condition holds; an unknown placeholder is an error. */
export function render(template: string, context: RenderContext, origin = 'template'): string {
  const rendering = new Rendering(context, origin);
  const source = template.replace(STANDALONE_BLOCK_TAG, '$1');
  let cursor = 0;

  for (const match of source.matchAll(TAG)) {
    rendering.text(source.slice(cursor, match.index));
    rendering.tag(match[1], match[2] ?? '');
    cursor = match.index + match[0].length;
  }

  rendering.text(source.slice(cursor));

  return rendering.result();
}
