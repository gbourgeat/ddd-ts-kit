import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import type { {{name.pascal}}Contract } from '../../../{{upstream.kebab}}/published-language/index.js';
import { {{name.constant}}_GATEWAY, {{name.constant}}_UPSTREAM } from '../../application/ports/{{context.kebab}}.ports.js';
import type { {{name.pascal}}Gateway } from '../../application/ports/{{name.kebab}}-gateway.port.js';

// TODO(platform): when {{upstream.kebab}} runs as its own service, turn this class into the remote adapter of {{name.pascal}}Gateway (an HTTP or RPC client with a timeout, retries and a fallback): the declaration stays, nothing else changes.
@Gateway({{name.constant}}_GATEWAY, [{{name.constant}}_UPSTREAM])
export class InProcess{{name.pascal}}Gateway implements {{name.pascal}}Gateway {
  constructor(readonly upstream: {{name.pascal}}Contract) {}

  // TODO(domain): implement each operation of {{name.pascal}}Gateway by asking `this.upstream`, translating its answer into the types of {{context.kebab}}.
}
