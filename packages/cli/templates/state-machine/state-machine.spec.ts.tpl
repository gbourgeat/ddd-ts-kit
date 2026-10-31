import { describe, expect, it } from '{{tests.module}}';
import { {{machine.constant}} } from '{{alias.context}}/domain/state-machines/{{aggregate.kebab}}.state-machine{{alias.ext}}';
import { {{machine.status}} } from '{{alias.context}}/domain/vocabularies/{{machine.statusKebab}}.vocabulary{{alias.ext}}';

describe('The lifecycle of {{aggregate.article}} {{aggregate.words}}', () => {
  it('starts in {{machine.initialValue}}', () => {
    expect({{machine.constant}}.start({{machine.initial}})).toBe({{machine.initial}});
  });
{{#if machine.hasTransitions}}

{{machine.cases}}
{{/if}}

{{#if refusals.named}}
  // TODO(domain): once `refused` names a refusal of its own (`ddd-ts-kit generate error {{context.kebab}} <Refusal> <factory>`), expect its code here; add a case per guard.
{{/if}}
{{#unless refusals.named}}
  // TODO(domain): once `refused` names a refusal of {{aggregate.pascal}}Error, expect its code here; add a case per guard.
{{/unless}}
  it.todo('refuses each forbidden transition with the refusal of the aggregate');
});
