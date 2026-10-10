import type { ExpectedSpan } from './expected-span.js';
import type { SpanNode } from './span-node.js';

/** What differs between the spans found under one parent and the ones expected there, as sentences. */
export function spanMismatches(actual: readonly SpanNode[], expected: readonly ExpectedSpan[], under = 'the trace'): string[] {
  const found = actual.map((span) => span.name).join(', ') || 'none';
  const wanted = expected.map((span) => span.name).join(', ') || 'none';

  if (found !== wanted) return [`under ${under}: expected the spans [${wanted}], found [${found}]`];

  return expected.flatMap((span, index) => {
    const node = actual[index];

    return node === undefined ? [] : [...ownMismatches(node, span), ...spanMismatches(node.children, span.children ?? [], `"${span.name}"`)];
  });
}

function ownMismatches(actual: SpanNode, expected: ExpectedSpan): string[] {
  const mismatches: string[] = [];

  if (expected.kind !== undefined && expected.kind !== actual.kind) {
    mismatches.push(`"${actual.name}": expected the kind ${expected.kind}, found ${actual.kind}`);
  }

  if (expected.status === undefined ? actual.status === 'ERROR' : expected.status !== actual.status) {
    mismatches.push(`"${actual.name}": expected the status ${expected.status ?? 'not ERROR'}, found ${actual.status}`);
  }

  for (const [key, value] of Object.entries(expected.attributes ?? {})) {
    const found = actual.attributes[key];

    if (JSON.stringify(found) !== JSON.stringify(value)) {
      mismatches.push(`"${actual.name}": expected ${key} to be ${shown(value)}, found ${shown(found)}`);
    }
  }

  return mismatches;
}

function shown(value: unknown): string {
  return value === undefined ? 'absent' : JSON.stringify(value);
}
