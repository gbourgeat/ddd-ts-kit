import type { {{name.pascal}} } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';

export class Fake{{name.pascal}} implements {{name.pascal}} {
  // TODO(domain): implement each operation of {{name.pascal}} in memory, and expose what was received so that a test can assert on it without a mocking library.
}
