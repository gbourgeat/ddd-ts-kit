import { marker } from '../markers/marker';

const SECTION = ['## Personal data', '', '<!-- ddd-ts-kit:personal-data -->', '<!-- /ddd-ts-kit:personal-data -->', ''];
const BEFORE = ['## Permissions', '## Reference'];

/**
 * A CONTEXT.md written before the kit listed personal data gets the section once its context
 * declares some, before its permissions (or its reference, or at its end): what people wrote is
 * not moved.
 */
export function ensurePersonalDataRegion(content: string): string {
  const lines = content.split('\n');

  if (lines.some((line) => marker('personal-data', false).test(line))) {
    return content;
  }

  const at = BEFORE.map((heading) => lines.indexOf(heading)).find((index) => index !== -1);

  if (at === undefined) {
    return `${content.replace(/\n*$/, '\n')}\n${SECTION.join('\n')}`;
  }

  lines.splice(at, 0, ...SECTION);

  return lines.join('\n');
}
