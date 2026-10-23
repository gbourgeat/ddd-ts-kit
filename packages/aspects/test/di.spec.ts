import { describe, expect, it } from 'vitest';
import {
  createApplication,
  createTestApplication,
  defineContextModule,
  kernelModule,
  type Decorate,
} from '@ddd-ts-kit/di';
import { Cache, Clock, InMemoryLogger, InMemoryMetrics, Logger, Metrics } from '@ddd-ts-kit/kernel';
import {
  aspects,
  cached,
  defineAspect,
  forKinds,
  forMethods,
  installAspectRuntime,
  logged,
  retry,
  timed,
  when,
  type Aspect,
} from '../src';
import { withAspectRuntime } from '../src/testing';
import { ArchivedQuotes } from './support/pricing/application/ports/archived-quotes.port';
import { Now } from './support/pricing/application/ports/now.port';
import { Quotes } from './support/pricing/application/ports/quotes.port';
import { QuoteGateway } from './support/quote-gateway';
import { Unreachable } from './support/unreachable';

function recording(journal: string[], label: string): Aspect {
  return defineAspect((joinPoint) => async ({ proceed }) => {
    journal.push(`${label} ${joinPoint.kind ?? 'no kind'} ${joinPoint.context ?? ''} ${joinPoint.token ?? ''}`);

    return proceed();
  });
}

describe('aspects on one binding, with .with(...)', () => {
  it('wrap the bound class and nothing else, the first outermost', async () => {
    const journal: string[] = [];

    const pricing = defineContextModule({
      name: 'pricing',
      register(builder) {
        builder
          .bind(Quotes)
          .toClass(QuoteGateway)
          .as('external')
          .with(recording(journal, 'outer'), recording(journal, 'inner'));

        builder.bind(ArchivedQuotes).toClass(QuoteGateway).as('external');
      },
    });

    const app = createApplication({ modules: [pricing] });

    await app.resolve(Quotes).quote('EUR-USD');
    await app.resolve(ArchivedQuotes).quote('EUR-USD');

    expect(app.resolve(Quotes)).toBeInstanceOf(QuoteGateway);
    expect(journal).toEqual(['outer external pricing Quotes', 'inner external pricing Quotes']);
  });

  it('give an adapter its resilience where it is bound', async () => {
    const pricing = defineContextModule({
      name: 'pricing',
      register(builder) {
        builder
          .bind(Quotes)
          .toFactory(() => new QuoteGateway().failNext(new Unreachable()))
          .as('external')
          .with(retry({ attempts: 2, sleep: async () => undefined }));
      },
    });

    const quotes = createApplication({ modules: [pricing] }).resolve(Quotes);

    expect(await quotes.quote('EUR-USD')).toMatchObject({ rate: 1.08 });
    expect(quotes.calls).toHaveLength(2);
  });
});

describe('aspects on every binding, as the decorate hook', () => {
  const pricing = defineContextModule({
    name: 'pricing',
    register(builder) {
      builder.bind(Quotes).toClass(QuoteGateway).as('external');
      builder.bind(ArchivedQuotes).toClass(QuoteGateway).as('repository');
      builder.bind(Now).toFactory((resolve) => resolve(Clock));
    },
  });

  it('observe what the selectors pick, with the collaborators of the kernel', async () => {
    const logger = new InMemoryLogger();
    const metrics = new InMemoryMetrics();

    const app = createApplication({
      modules: [kernelModule({ logger, metrics }), pricing],
      decorate: aspects(
        when(forKinds('external', 'repository'), logged(), timed()),
        when(
          forKinds('external'),
          when(forMethods('quote'), cached({ key: (_method, [pair]) => String(pair), ttlMs: 1000 })),
        ),
      ),
    });

    installAspectRuntime({
      logger: app.resolve(Logger),
      metrics: app.resolve(Metrics),
      cache: app.resolve(Cache),
      clock: app.resolve(Clock),
    });

    await app.resolve(Quotes).quote('EUR-USD');
    await app.resolve(Quotes).quote('EUR-USD');
    await app.resolve(ArchivedQuotes).quote('EUR-USD');
    installAspectRuntime({});

    expect(app.resolve(Quotes).calls).toHaveLength(1);
    expect(metrics.counterValue('dependency_call_total', { context: 'pricing', kind: 'external' })).toBe(2);
    expect(metrics.counterValue('dependency_call_total', { kind: 'repository' })).toBe(1);
    expect(logger.entries.filter((entry) => entry.level === 'info')).toHaveLength(3);
    expect(metrics.counterValue('dependency_call_total', { class: 'SystemClock' })).toBe(0);
  });

  it('come around the aspects of a binding, and compose with any other decorate function', async () => {
    const journal: string[] = [];

    const tracing: Aspect = (instance, info) => {
      journal.push(`traced ${info?.kind ?? 'no kind'}`);

      return instance;
    };

    const decorate: Decorate = aspects(tracing, recording(journal, 'global'));

    const module = defineContextModule({
      name: 'pricing',
      register(builder) {
        builder.bind(Quotes).toClass(QuoteGateway).as('gateway').with(recording(journal, 'binding'));
      },
    });

    await createApplication({ modules: [module], decorate })
      .resolve(Quotes)
      .quote('EUR-USD');

    expect(journal).toEqual(['traced gateway', 'global gateway pricing Quotes', 'binding gateway pricing Quotes']);
  });

  it('leave alone what is not an object', () => {
    const decorate = aspects(logged());

    expect(decorate('a value', { token: Quotes, context: 'pricing' })).toBe('a value');
    expect(decorate(null, { token: Now, context: 'pricing' })).toBeNull();
  });
});

describe('a test application', () => {
  it('provides the fakes the aspects write to', async () => {
    const pricing = defineContextModule({
      name: 'pricing',
      register(builder) {
        builder.bind(Quotes).toClass(QuoteGateway).as('external').with(logged(), timed());
      },
    });

    const app = createTestApplication({ modules: [pricing] });

    await withAspectRuntime(app, () => app.get(Quotes).quote('EUR-USD'));

    expect(app.logger.entries.map((entry) => entry.message)).toEqual([
      'QuoteGateway.quote started',
      'QuoteGateway.quote succeeded',
    ]);

    expect(app.metrics.counterValue('dependency_call_total', { outcome: 'success' })).toBe(1);
  });
});
