import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import type { {{name.pascal}}Contract } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
import { {{name.pascal}}Gateway } from '{{alias.context}}/application/ports/{{name.kebab}}-gateway.port{{alias.ext}}';

// TODO(platform): when {{upstream.kebab}} runs as its own service, turn this class into the remote adapter of {{name.pascal}}Gateway (an HTTP or RPC client with a timeout, retries and a fallback): the declaration stays, nothing else changes.
@Gateway({{name.pascal}}Gateway)
export class InProcess{{name.pascal}}Gateway implements {{name.pascal}}Gateway {
  constructor(readonly upstream: {{name.pascal}}Contract) {}

  // TODO(domain): implement each operation of {{name.pascal}}Gateway by asking `this.upstream`, translating its answer into the types of {{context.kebab}}.
}
