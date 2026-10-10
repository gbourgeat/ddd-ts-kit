import { CONTEXT_DOC_HEADINGS } from '../canonical/context-doc-headings.js';
import { SAMPLES } from './samples.js';

/** A CONTEXT.md holding the given sections, with the classification and the glossary given. */
export function contextDoc(
  classification: string,
  headings: readonly string[] = CONTEXT_DOC_HEADINGS,
  glossary: string = SAMPLES.GLOSSARY,
): string {
  const body = (heading: string): string => {
    if (heading === '## Classification') {
      return classification;
    }

    return heading === '## Ubiquitous language' ? glossary : 'Text.';
  };

  return headings.map((heading) => `${heading}\n\n${body(heading)}\n`).join('\n');
}
