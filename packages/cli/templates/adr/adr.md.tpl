# ADR-{{adr.number}}: {{adr.title}}

- Status: proposed
- Date: {{adr.date}}
{{#if adr.deviation}}
- Deviates from: `{{adr.what}}`
{{/if}}

## Context

{{#if adr.deviation}}
{{adr.reason}}

{{/if}}
TODO(domain): describe the forces at play: what is needed, what the architecture reference says, and why they are in tension here.

## Decision

TODO(domain): state the decision in one or two sentences, in the active voice.

## Consequences

TODO(domain): say what becomes easier, what becomes harder, and what has to be watched from now on.

## Alternatives considered

TODO(domain): list the options that were weighed, the supported one first, and why each was not chosen.
{{#if adr.deviation}}

## Scope

TODO(domain): name exactly what the deviation covers (which files, which context, which rule) so that it does not spread.

## Removal condition

TODO(domain): say what has to be true for this deviation to be removed, and who checks it.
{{/if}}
