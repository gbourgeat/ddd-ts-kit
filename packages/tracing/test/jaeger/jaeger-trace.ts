import type { SpanNode } from '../../src/testing';

interface OtlpValue {
  readonly stringValue?: string;
  readonly intValue?: string | number;
  readonly doubleValue?: number;
  readonly boolValue?: boolean;
}

interface OtlpSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind?: number | string;
  readonly startTimeUnixNano: string;
  readonly attributes?: readonly { readonly key: string; readonly value: OtlpValue }[];
  readonly status?: { readonly code?: number | string };
  readonly links?: readonly { readonly traceId: string }[];
}

interface OtlpChunk {
  readonly result?: {
    readonly resourceSpans?: readonly { readonly scopeSpans?: readonly { readonly spans?: readonly OtlpSpan[] }[] }[];
  };
}

const KINDS: readonly SpanNode['kind'][] = ['INTERNAL', 'INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'];

const KIND_NAMES = [
  'SPAN_KIND_UNSPECIFIED',
  'SPAN_KIND_INTERNAL',
  'SPAN_KIND_SERVER',
  'SPAN_KIND_CLIENT',
  'SPAN_KIND_PRODUCER',
  'SPAN_KIND_CONSUMER',
];

/**
 * The traces Jaeger holds for a service, read through its HTTP API (`/api/v3/traces`, which
 * answers OTLP as JSON) and turned into the trees the harness compares, one per trace.
 */
export async function tracesOfService(queryUrl: string, service: string): Promise<SpanNode[][]> {
  const window = {
    from: new Date(Date.now() - 3_600_000).toISOString(),
    to: new Date(Date.now() + 60_000).toISOString(),
  };

  const query = `query.service_name=${service}&query.start_time_min=${window.from}&query.start_time_max=${window.to}`;
  const text = await (await fetch(`${queryUrl}/api/v3/traces?${query}`)).text();

  const spans = text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap(spansOf);

  const traceIds = [...new Set(spans.map((span) => span.traceId))];

  return traceIds.map((traceId) => treeOf(spans.filter((span) => span.traceId === traceId)));
}

function spansOf(line: string): OtlpSpan[] {
  const chunk: OtlpChunk = JSON.parse(line);

  return (chunk.result?.resourceSpans ?? []).flatMap((resource) =>
    (resource.scopeSpans ?? []).flatMap((scope) => scope.spans ?? []),
  );
}

function treeOf(spans: readonly OtlpSpan[]): SpanNode[] {
  const ordered = [...spans].sort((a, b) => (BigInt(a.startTimeUnixNano) < BigInt(b.startTimeUnixNano) ? -1 : 1));
  const known = new Set(ordered.map((span) => span.spanId));

  const nodeOf = (span: OtlpSpan): SpanNode => ({
    name: span.name,
    kind: kindOf(span.kind),
    status: span.status?.code === 2 || span.status?.code === 'STATUS_CODE_ERROR' ? 'ERROR' : 'UNSET',
    attributes: Object.fromEntries((span.attributes ?? []).map(({ key, value }) => [key, plain(value)])),
    traceId: span.traceId,
    spanId: span.spanId,
    links: (span.links ?? []).map((link) => link.traceId),
    children: ordered.filter((child) => child.parentSpanId === span.spanId).map(nodeOf),
  });

  return ordered.filter((span) => !known.has(span.parentSpanId ?? '')).map(nodeOf);
}

function kindOf(kind: number | string | undefined): SpanNode['kind'] {
  const position = typeof kind === 'string' ? KIND_NAMES.indexOf(kind) : (kind ?? 1);

  return KINDS[position] ?? 'INTERNAL';
}

function plain(value: OtlpValue): unknown {
  if (value.intValue !== undefined) {
    return Number(value.intValue);
  }

  return value.stringValue ?? value.doubleValue ?? value.boolValue;
}
