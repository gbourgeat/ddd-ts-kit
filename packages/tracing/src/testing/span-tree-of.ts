import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import type { SpanNode } from './span-node';

const KINDS: Readonly<Record<SpanKind, SpanNode['kind']>> = {
  [SpanKind.INTERNAL]: 'INTERNAL',
  [SpanKind.SERVER]: 'SERVER',
  [SpanKind.CLIENT]: 'CLIENT',
  [SpanKind.PRODUCER]: 'PRODUCER',
  [SpanKind.CONSUMER]: 'CONSUMER',
};

const STATUSES: Readonly<Record<SpanStatusCode, SpanNode['status']>> = {
  [SpanStatusCode.UNSET]: 'UNSET',
  [SpanStatusCode.OK]: 'OK',
  [SpanStatusCode.ERROR]: 'ERROR',
};

/**
 * The ended spans as trees: a span whose parent is not among them (no parent, or one of
 * another process) is a root. Roots and children come in the order given by `positionOf`.
 */
export function spanTreeOf(spans: readonly ReadableSpan[], positionOf: (spanId: string) => number): SpanNode[] {
  const ordered = [...spans].sort((a, b) => positionOf(a.spanContext().spanId) - positionOf(b.spanContext().spanId));
  const known = new Set(ordered.map((span) => span.spanContext().spanId));
  const parentOf = (span: ReadableSpan): string | undefined => span.parentSpanContext?.spanId;

  const nodeOf = (span: ReadableSpan): SpanNode => ({
    name: span.name,
    kind: KINDS[span.kind],
    status: STATUSES[span.status.code],
    attributes: { ...span.attributes },
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
    links: span.links.map((link) => link.context.traceId),
    children: ordered.filter((child) => parentOf(child) === span.spanContext().spanId).map(nodeOf),
  });

  return ordered.filter((span) => !known.has(parentOf(span) ?? '')).map(nodeOf);
}
