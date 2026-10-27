import type { {{name.pascal}} } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';

export class Simulated{{name.pascal}} implements {{name.pascal}} {
  // TODO(domain): this adapter stands in for the outside system where it is simulated (a sandbox, a demo), and nothing it does leaves the process. Answer each operation of {{name.pascal}} from records kept here, as the outside system would, in the types of {{context.kebab}}, and refuse what it would refuse; declare each one `async`. Keep the records in the shape the outside system sends and answer through its translator of infrastructure/anti-corruption when it has one, so that the simulation runs the same anti-corruption layer as the remote adapter.
}
