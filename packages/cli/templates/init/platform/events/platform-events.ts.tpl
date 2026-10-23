{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
{{#if httpCache.varnish}}
import { PublishedCacheInvalidation, scopedPublisher } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless httpCache.varnish}}
import { scopedPublisher } from '@ddd-ts-kit/kernel';
{{/unless}}
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';
import type { Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import type { PlatformOptions } from '{{alias.platform}}/composition/platform-options{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

type Events = Pick<Platform, 'publisher' | 'subscriber' | 'eventBus'{{#if broker.external}} | 'subscriberFor'{{/if}}{{#if httpCache.varnish}} | 'cacheInvalidation'{{/if}}>;

/**
 * Use cases publish with the correlation id of the work in progress, so everything one request
 * causes is found again.{{#if httpCache.varnish}} The purges a change asks for are written to the outbox with its
 * events, through the same publisher: a rollback takes them away, the relay sends them to Varnish
 * once committed.{{#if httpCache.perTenant}} They are filed under the tenant of the work, as the answers are tagged.{{/if}}{{/if}}
 */
export function platformEvents(persistence: Persistence, options: PlatformOptions, foundations: Foundations): Events {
  const { events } = options;
{{#if httpCache.varnish}}
  const { scope, traced, ids, clock } = foundations;
{{/if}}
{{#unless httpCache.varnish}}
  const { scope, traced } = foundations;
{{/unless}}
  const trace = options.traceConsumers ?? 'continue';
{{#if events.outbox}}
  // `outbox append <type>` inside the request; the relay publishes later, in the same trace.
  const publisher = traced.publisher(scopedPublisher(new OutboxPublisher(persistence.outbox), scope));
{{/if}}
{{#unless events.outbox}}
  const publisher = traced.publisher(scopedPublisher(events.bus, scope));
{{/unless}}

  return {
    publisher,
    subscriber: tracedSubscriber(events.bus, { trace }),
{{#if broker.external}}
    subscriberFor: (context) => tracedSubscriber(events.forConsumer(context), { trace }),
{{/if}}
    eventBus: tracedPublisher(events.bus),
{{#if httpCache.varnish}}
{{#if httpCache.perTenant}}
    cacheInvalidation: new PublishedCacheInvalidation({ publisher, ids, clock, scope, perTenant: true }),
{{/if}}
{{#unless httpCache.perTenant}}
    cacheInvalidation: new PublishedCacheInvalidation({ publisher, ids, clock, scope }),
{{/unless}}
{{/if}}
  };
}
