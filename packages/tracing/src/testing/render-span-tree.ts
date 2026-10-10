import type { ExpectedSpan } from './expected-span.js';

/**
 * A tree as indented text, one span per line: `name [KIND] ERROR {key=value}`. Only the
 * attributes named in `keys` are shown, so two trees rendered with the same keys compare line
 * by line.
 */
export function renderSpanTree(spans: readonly ExpectedSpan[], keys: readonly string[] = [], depth = 0): string {
  return spans
    .flatMap((span) => [lineOf(span, keys, depth), renderSpanTree(span.children ?? [], keys, depth + 1)])
    .filter((line) => line !== '')
    .join('\n');
}

function lineOf(span: ExpectedSpan, keys: readonly string[], depth: number): string {
  const attributes = keys
    .filter((key) => span.attributes?.[key] !== undefined)
    .map((key) => `${key}=${JSON.stringify(span.attributes?.[key])}`);

  return [
    `${'  '.repeat(depth)}${span.name}`,
    ...(span.kind === undefined ? [] : [`[${span.kind}]`]),
    ...(span.status === 'ERROR' ? ['ERROR'] : []),
    ...(attributes.length === 0 ? [] : [`{${attributes.join(', ')}}`]),
  ].join(' ');
}
