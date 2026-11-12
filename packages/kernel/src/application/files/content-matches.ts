import type { ContentExpectation } from './content-expectation';
import { contentRuleOf } from './content-rule-of';
import { looksLikeText } from './looks-like-text';
import { mediaTypeOf } from './media-type-of';
import { signatureOf } from './signature-of';
import { ZIP_CONTAINERS } from './zip-containers';

/**
 * Whether the first bytes of a content are what its declared media type says, read on the bytes
 * and never on a file name, by the content rule of that type (`contentRuleOf`):
 *
 * - a signature: a PDF starts with `%PDF-`, a PNG with its eight bytes, an office document is a zip;
 * - text, for the text types of the kit and those the route states as `text`: no control
 *   character, valid UTF-8 unless the route takes `single-byte` text (`TextRule`), and never the
 *   signature of a binary format;
 * - `unchecked`, stated by the route: the bytes are taken as they are.
 *
 * A type with no rule never matches, and the rule of a family is not one for SVG, HTML or
 * JavaScript: those pass only when the route states them by name.
 */
export function contentMatches(
  head: Uint8Array,
  declared: string,
  expectation: Pick<ContentExpectation, 'text' | 'contentRules'> = {},
): boolean {
  const essence = mediaTypeOf(declared);
  const rule = contentRuleOf(essence, expectation.contentRules);

  if (rule === 'unchecked') {
    return true;
  }

  const signature = signatureOf(head);

  if (signature !== undefined) {
    return rule === 'signature' && proves(signature, essence);
  }

  return rule === 'text' && looksLikeText(head, expectation.text ?? 'utf-8');
}

function proves(signature: string, essence: string): boolean {
  return signature === essence || (signature === 'application/zip' && ZIP_CONTAINERS.includes(essence));
}
