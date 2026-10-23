import { chainLinks } from './chain-links';
import { LINE_WIDTH } from './line-width';
import { nesting } from './nesting';
import { splitTopLevel } from './split-top-level';

const STEP = '  ';

/**
 * A call whose last argument is written over several lines, a function or an object
 * (`on('name', async (event) => {`): once its first line no longer fits, the formatter breaks
 * the chain the call ends when there is one, and otherwise gives each argument a line of its
 * own. Either way what the last argument holds moves one step to the right.
 */
export function openCallback(lines: readonly string[], indent: string): string[] {
  const first = lines.findIndex((line) => indent.length + line.length > LINE_WIDTH && /(?:=>|,) \{$/.test(line));
  const own = /^\s*/.exec(lines[first] ?? '')?.[0] ?? '';
  const last = lines.findIndex((line, index) => index > first && line.startsWith(`${own}});`));

  if (first === -1 || last === -1) {
    return [...lines];
  }

  const head = (lines[first] ?? '').trim();

  const held = lines
    .slice(first + 1, last)
    .map((line) => (line.trim() === '' ? '' : `${STEP}${line.slice(own.length)}`));

  return [
    ...lines.slice(0, first),
    ...opened(head, held).map((line) => (line === '' ? '' : `${own}${line}`)),
    ...openCallback(lines.slice(last + 1), indent),
  ];
}

function opened(head: string, held: readonly string[]): string[] {
  const [start = '', ...calls] = chainLinks(head);
  const open = nesting(head).lastIndexOf(0);
  const passed = splitTopLevel(head.slice(open + 1));

  if (calls.length > 1) {
    return [start, ...calls.map((call) => `${STEP}${call}`), ...held, `${STEP}});`];
  }

  return [
    head.slice(0, open + 1),
    ...passed.slice(0, -1).map((argument) => `${STEP}${argument},`),
    `${STEP}${passed.at(-1) ?? ''}`,
    ...held,
    `${STEP}},`,
    ');',
  ];
}
