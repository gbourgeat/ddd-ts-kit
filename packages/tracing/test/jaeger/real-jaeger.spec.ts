import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initTracing, type TracingHandle } from '../../src/node.js';
import { expectSpanTree, type SpanNode } from '../../src/testing.js';
import { aClinic } from '../support/clinic/a-clinic.js';
import { bookingTree, confirmationTree, recordingTree } from '../support/clinic/trees.js';
import { tracesOfService } from './jaeger-trace.js';
import { startThrowawayJaeger, type ThrowawayJaeger } from './throwaway-jaeger.js';

/** Set it to the image to run, `jaegertracing/jaeger:2.22.0`, to run this spec against a real Jaeger. */
const IMAGE = process.env['DDD_TS_KIT_TEST_JAEGER_IMAGE'];

async function eventually<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = await read();

    if (ready(value)) return value;

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return read();
}

function count(spans: readonly SpanNode[]): number {
  return spans.reduce((total, span) => total + 1 + count(span.children), 0);
}

describe.skipIf(IMAGE === undefined)('one action, exported over OTLP to a real Jaeger', { timeout: 120_000 }, () => {
  let jaeger: ThrowawayJaeger;
  let tracing: TracingHandle;

  beforeAll(async () => {
    jaeger = await startThrowawayJaeger(IMAGE ?? '');
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = jaeger.otlpUrl;
    tracing = initTracing({ serviceName: 'clinic' });
  }, 120_000);

  afterAll(async () => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    await jaeger.remove();
  });

  it('is found there as one trace, with the tree a person reads in the interface', async () => {
    const clinic = await aClinic();

    await clinic.book('09:00');
    await clinic.relay.tick();
    await clinic.relay.tick();
    await tracing.shutdown();

    const traces = await eventually(
      () => tracesOfService(jaeger.queryUrl, 'clinic'),
      (found) => found.length === 1 && count(found[0] ?? []) === 14,
    );

    expect(traces).toHaveLength(1);

    expectSpanTree(traces[0] ?? [], [
      bookingTree([
        {
          name: 'publish scheduling.appointment.booked',
          kind: 'PRODUCER',
          attributes: { 'messaging.system': 'in-memory', 'messaging.destination.name': 'scheduling.appointment.booked' },
          children: [confirmationTree(), recordingTree()],
        },
      ]),
    ]);
  });
});
