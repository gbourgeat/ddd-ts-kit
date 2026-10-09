---
name: model-context
description: >-
  Strategic DDD for one bounded context. Finds the boundary, writes the ubiquitous language
  (glossary) before any code, classifies the context and declares its relationships in the
  context map. Use before creating a context, when a concept has no obvious home, when a
  business term is missing from a glossary, when two contexts start depending on each
  other, or when the user asks about boundaries, subdomains or the context map.
argument-hint: "[context-name]"
allowed-tools:
  - Bash(npx ddd-ts-kit list *)
  - Bash(npx ddd-ts-kit generate context *)
  - Bash(npx ddd-ts-kit check *)
---

# Model a bounded context

Context under discussion: `$ARGUMENTS`

Strategic decisions are the user's. Your job is to make them explicit, challenge them and
write them down. Never create a context silently because a file needed a home.

## 1. Read the map first

`npx ddd-ts-kit list` gives contexts, classifications, upstreams, aggregates and use cases.
Read the `CONTEXT.md` of the neighbours of the subject.

## 2. Find the boundary

Work through these with the user, in their vocabulary:

- **Language test.** Does a word change meaning here? ("Customer" for billing is a payer, for
  support a requester.) A different meaning is a different context.
- **Autonomy test.** Can this part change its rules or be rewritten without its neighbours
  noticing? Who decides its rules?
- **Consistency test.** What must be true at every instant (same transaction) versus
  eventually? What needs immediate consistency lives in one aggregate, hence one context.
- **Size test.** A context that only stores data for another is a table, not a context. A
  context whose glossary has two unrelated halves is two contexts.

Signals that the boundary is wrong: a use case that writes in two contexts in one transaction,
a context that needs most fields of another's aggregate, a shared kernel that keeps growing.

## 3. Classify

- `core`: why the business wins. Richest model, most tests, never outsourced.
- `supporting`: necessary and specific, but not differentiating. Simple model.
- `generic`: solved elsewhere (auth, payments, email). Buy or wrap behind an
  anti-corruption layer.

## 4. Declare relationships

For each dependency, name upstream, downstream and the pattern:

| Pattern | Use when |
|---|---|
| `published-language` | default: the upstream publishes events and contracts made for consumers |
| `customer-supplier` | downstream needs are planned into the upstream's backlog |
| `conformist` | downstream accepts the upstream model as is |
| `anti-corruption-layer` | downstream protects its model with a translator in `infrastructure/anti-corruption/` |
| `open-host-service` | upstream exposes a protocol for many consumers |
| `shared-kernel` | two contexts co-own a small model; costly, justify it |

No cycle. If A needs B and B needs A, either they are one context, or one direction becomes an
event, or a third context is missing.

## 5. Ubiquitous language first

No code before the glossary. With the user, list the terms of this context: each noun the
business uses (candidates for aggregates, entities, value objects), each verb (candidates for
commands and aggregate methods), each fact (candidates for events, in the past tense). For
each: the meaning here in one sentence, and what it must not be confused with in a
neighbouring context. Reject technical words (`record`, `data`, `item`, `manager`) and ask
for the business word. Ten precise terms beat fifty vague ones.

The checker enforces it (`language/glossary-term`): a class or use case named with a word
absent from the glossary fails, and the scaffolder refuses the name unless the term is
supplied with `--term "<Term>=<meaning>"`.

## 6. Write it down

```bash
npx ddd-ts-kit generate context <name> --classification <c> --upstream <ctx>:<relationship> \
  --purpose "<two sentences>" --term "<Term>=<meaning>" --term ...
```

Then fill `CONTEXT.md`: purpose in two sentences, glossary (term, meaning here, and what it is
NOT), aggregates with their invariants in one line each, published events, relationships.
The glossary is the source of every class, method and event name in the context. A name absent
from it gets added to it first.

Finish with `npx ddd-ts-kit check --rule tree/context-doc --rule context/no-cycle --rule context/declared-relationship`.
