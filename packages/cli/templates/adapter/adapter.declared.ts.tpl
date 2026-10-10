{{#unless adapter.decorated}}
import { retry, timeout } from '@ddd-ts-kit/aspects';
{{/unless}}
{{#if adapter.decorated}}
import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';
{{/if}}
import { {{adapter.decorator}} } from '@ddd-ts-kit/kernel/declarations';
import { {{name.constant}} } from '../../application/ports/{{context.kebab}}.ports.js';
import type { {{name.pascal}} } from '../../application/ports/{{name.kebab}}.port.js';
import { ownPolicy } from '{{paths.persistenceToPlatform}}/resilience.js';

interface OutboundCall {
  readonly operation: string;
  readonly payload: unknown;
}

type Transport = (call: OutboundCall, signal?: AbortSignal) => Promise<unknown>;

{{#if adapter.decorated}}
@{{adapter.decorator}}({{name.constant}}, { {{adapter.kindOption}}aspects: [ownPolicy()] })
{{/if}}
{{#unless adapter.decorated}}
@{{adapter.decorator}}({{name.constant}}, { {{adapter.kindOption}}aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))] })
{{/unless}}
export class Remote{{name.pascal}} implements {{name.pascal}} {
  constructor(readonly transport: Transport = notConnected) {}

{{#if adapter.decorated}}
  // TODO(domain): implement each operation of {{name.pascal}} by sending one call through `this.send` and translating the answer into the types of {{context.kebab}}; the policy of this adapter is part of its definition and is carried by `send` alone.
  @Retry({ attempts: 3, backoff: { baseMs: 100 } })
  @Timeout(2000, { signal: true })
  async send(call: OutboundCall, signal?: AbortSignal): Promise<unknown> {
    return this.transport(call, signal);
  }
{{/if}}
{{#unless adapter.decorated}}
  // TODO(domain): implement each operation of {{name.pascal}} by sending one call through `this.transport` and translating the answer into the types of {{context.kebab}}; declare each one `async`, so that the policy stated in the declaration applies from its first call.
{{/unless}}
}

// TODO(platform): replace by the real client of the outside system (fetch on a base URL of the validated config, an SDK): bind it to a token of {{context.kebab}}.ports.ts in the platform module and name that token in the dependency list of the declaration.
function notConnected(): Promise<never> {
  return Promise.reject(new Error('Remote{{name.pascal}} has no transport yet'));
}
