import type { {{name.pascal}}Contract } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
import type { {{name.pascal}}Gateway } from '{{alias.context}}/application/ports/{{name.kebab}}-gateway.port{{alias.ext}}';

// TODO(platform): when {{upstream.kebab}} runs as its own service, write the remote adapter of {{name.pascal}}Gateway next to this one (an HTTP or RPC client with a timeout, retries and a fallback) and bind it instead; nothing else changes.
export class InProcess{{name.pascal}}Gateway implements {{name.pascal}}Gateway {
  constructor(readonly upstream: {{name.pascal}}Contract) {}

  // TODO(domain): implement each operation of {{name.pascal}}Gateway by asking `this.upstream`, translating its answer into the types of {{context.kebab}}.
}
