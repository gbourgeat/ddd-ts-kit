import type { {{name.pascal}}Gateway } from '{{alias.context}}/application/ports/{{name.kebab}}-gateway.port.js';

export class Fake{{name.pascal}}Gateway implements {{name.pascal}}Gateway {
  // TODO(domain): implement each operation of {{name.pascal}}Gateway in memory, with what {{upstream.kebab}} would answer given by the test.
}
