{{#unless adapter.decorated}}
import { retry, timeout } from '@ddd-ts-kit/aspects';
{{/unless}}
{{#if adapter.decorated}}
import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';
{{/if}}
import { {{adapter.decorator}} } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}} } from '../../application/ports/{{name.kebab}}.port.js';
import { ownPolicy } from '{{paths.persistenceToPlatform}}/resilience/own-policy.js';

interface OutboundCall {
  readonly operation: string;
  readonly payload: unknown;
}

{{#if adapter.decorated}}
@{{adapter.decorator}}({{name.pascal}}, { {{adapter.kindOption}}aspects: [ownPolicy()] })
{{/if}}
{{#unless adapter.decorated}}
@{{adapter.decorator}}({{name.pascal}}, {
  {{#if adapter.hasKind}}
  kind: '{{adapter.kind}}',
  {{/if}}
  aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))],
})
{{/unless}}
export class Remote{{name.pascal}} implements {{name.pascal}} {
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

  // TODO(platform): replace the body by the real client of the outside system (fetch on a base URL of the validated config, an SDK): type what it needs by an abstract class of application/ports (its settings), bind that class in the platform module and name it in the dependency list of the declaration.
  protected async transport(call: OutboundCall, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();

    throw new Error(`Remote{{name.pascal}} has no transport yet: "${call.operation}" was not sent`);
  }
}
