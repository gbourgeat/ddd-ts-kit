import type { {{event.pascal}} } from '../../domain/events/{{event.kebab}}.event.js';

export class {{event.pascal}}EventHandler {
  async handle(event: {{event.pascal}}): Promise<void> {
    // TODO(domain): state the policy "when {{event.words}}, then ..." and carry it out by executing a command handler of this context (inject it through the constructor); a reaction in another context goes through an integration event instead.
  }
}
