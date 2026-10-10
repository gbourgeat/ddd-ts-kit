import { marker } from '../markers/marker.js';

const CLOSING_MARKER = /^\s*<!--\s*\/ddd-ts-kit:[\w-]+\s*-->\s*$/;
const SECTION = ['', '## Reference', '', '<!-- ddd-ts-kit:reference -->', '<!-- /ddd-ts-kit:reference -->'];

/**
 * A CONTEXT.md written before the kit generated its reference gets the section once, right
 * after its last generated list, or at its end when it has none: what people wrote is not moved.
 */
export function ensureReferenceRegion(content: string): string {
  const lines = content.split('\n');

  if (lines.some((line) => marker('reference', false).test(line))) {
    return content;
  }

  const last = lines.findLastIndex((line) => CLOSING_MARKER.test(line));

  if (last === -1) {
    return `${content.replace(/\n*$/, '\n')}${SECTION.join('\n')}\n`;
  }

  lines.splice(last + 1, 0, ...SECTION);

  return lines.join('\n');
}
