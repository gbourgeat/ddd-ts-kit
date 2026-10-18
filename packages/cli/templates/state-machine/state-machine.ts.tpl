import { defineStateMachine } from '@ddd-ts-kit/kernel';
import { {{machine.status}} } from '{{alias.context}}/domain/vocabularies/{{machine.statusKebab}}.vocabulary{{alias.ext}}';

export const {{machine.constant}} = defineStateMachine({
  states: Object.values({{machine.status}}),
  initial: [{{machine.initial}}],
  transitions: {
{{#if machine.hasTransitions}}
{{machine.transitions}}
{{/if}}
{{#unless machine.hasTransitions}}
    // TODO(domain): one transition per intention method of {{aggregate.pascal}}, named after it: `issue: { from: [{{machine.initial}}], to: <state> }`; a transition without `to` keeps its state, a `guard` refuses what the status alone does not decide.
{{/unless}}
  },
{{#if refusals.named}}
  // TODO(domain): refuse a forbidden transition with a static factory of the refusal named after it, `refused: ({ from, transition }, context) => <Refusal>.for<Fact>(...)` (`ddd-ts-kit generate error {{context.kebab}} <Refusal> <factory>`); until then the refusal is TransitionError.forbidden, code FORBIDDEN_TRANSITION.
{{/if}}
{{#unless refusals.named}}
  // TODO(domain): refuse a forbidden transition with a static factory of {{aggregate.pascal}}Error, `refused: ({ from, transition }, context) => {{aggregate.pascal}}Error.<refusal>(...)`; until then the refusal is TransitionError.forbidden, code FORBIDDEN_TRANSITION.
{{/unless}}
});
