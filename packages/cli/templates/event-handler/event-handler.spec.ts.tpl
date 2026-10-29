import { describe, it } from '{{tests.module}}';

describe('When {{event.words}}', () => {
{{#unless handler.afterCommit}}
  // TODO(domain): replace each entry below by a test named after the policy, of one shape: give `new {{handler.pascal}}EventHandler(commands)` a `RecordingCommandBus` of `@ddd-ts-kit/kernel/testing`, hand it the fact (`new {{event.pascal}}('{{aggregate.kebab}}-1', occurredAt)`) and assert the command it sent, `expect(commands.executed).toEqual([new ...Command(...)])`.
  it.todo('carries out the policy that follows the fact');
{{/unless}}
{{#if handler.afterCommit}}
  // TODO(domain): replace each entry below by a test named after the effect, of one shape: give `new {{handler.pascal}}EventHandler(...)` the fake of its port, hand it the fact (`new {{event.pascal}}('{{aggregate.kebab}}-1', occurredAt)`) and assert what the fake kept.
  it.todo('carries out the effect that follows the commit of the fact');
{{/if}}
  it.todo('does nothing when the policy does not apply');
});
