---
name: bounded-contexts
description: >-
  Finds the bounded contexts of a system and classifies each as core, supporting or generic,
  from the domain discovery or from an existing model. Produces
  docs/architecture/contexts.md with the reason for every boundary. Use when cutting a
  system into contexts, when a concept has no obvious home, when a context grows two
  vocabularies, when a context grows too large to read, when two contexts need each other,
  or when the user asks about boundaries, subdomains, sub-contexts, modules, splitting or
  merging contexts. For the terms of one context use glossary; for the relationships between
  contexts use context-map.
argument-hint: "[context or concept under discussion]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(npx ddd-ts-kit list *)
---

# Find and classify the bounded contexts

Under discussion: `$ARGUMENTS`

Input: `docs/architecture/discovery.md` for a new system, `npx ddd-ts-kit list --json` for an
existing one. Boundaries are the owner's decision: propose, argue, wait.

## 1. Propose candidates

Walk the timeline of the discovery and group commands and events that speak one language.
A boundary usually sits where:

- a **word changes meaning** ("customer" is a payer here, a recipient there);
- the **actor or the owner of the rules changes** (sales, accounting, warehouse);
- a **policy** links an event to a command ("whenever Order placed, Reserve stock"): the two
  sides rarely belong together;
- an **external system** has its own model: it is wrapped, not spread.

## 2. Test each candidate

| Test | Question | A no means |
|---|---|---|
| Language | Does every term have one meaning inside? | split |
| Autonomy | Can its rules change without its neighbours noticing? Is there one owner? | move the shared rule to one side |
| Consistency | Is everything that must be true at the same instant inside one context? | merge, or accept eventual consistency and say so |
| Size | Does it decide something, beyond storing data for another? | it is a table of its neighbour, merge |
| Team | Could one person or one agent hold it in mind alone? | split along the next language seam |

Prefer few contexts. Two well-named ones beat five guessed ones, and splitting later is
cheap when the language is clean. Warning signs: a use case writing in two contexts, a
context needing most fields of another's aggregate, a shared kernel that grows.

## 3. Classify

| Classification | It is | Consequence |
|---|---|---|
| `core` | why the business wins | richest model, most tests, best people, never bought |
| `supporting` | needed and specific, not differentiating | simple model, plain design |
| `generic` | solved elsewhere (identity, payment, mail) | buy or wrap behind an anti-corruption layer |

One or two cores at most: if everything is core, nothing is.

## When a context grows too large, or two need each other

There is no sub-context, child context or nested context in the references (Evans, *DDD
Reference*). A part with a language of its own is a context; a part of one model, same
language, same schema, same transaction, is a **module of the model**: one folder under
`domain/` and `application/`, declared in `contexts.<name>.modules`, named with glossary terms
(`docs/concepts/modules.md`).

- **Too large to read, one language**: propose modules, each a cluster of glossary terms used
  together, with one sentence of purpose. Never technical names (`shared`, `common`, `core`).
- **Two contexts that need each other** (`context/no-cycle`): ask in this order
  (`docs/guides/cycle-between-contexts.md`): 1. one language, one model? then one context
  divided into modules; 2. can one direction become an integration event? 3. is a concept
  missing, the one both fight over? Refusing the cycle is a choice of the kit, not of DDD.
- **A handler with too many dependencies** is not a boundary question: see
  `docs/guides/many-dependencies.md`.

Once the owner agreed, `npx ddd-ts-kit generate module <context> <module> --purpose "..."` and
`npx ddd-ts-kit move-to-module <context> <module> <path>...` (skill `ddd-ts-kit:scaffold`).

## 4. Write the artefact

```markdown
# Bounded contexts

| Context | Classification | Purpose (two sentences, business terms) | Owns (events of the timeline) | Owner |
|---|---|---|---|---|
| ordering | core | Takes and tracks customer orders. ... | 1 to 4 | sales |

## Why these boundaries
- ordering / billing: "order" means a request to sales and a debt to accounting (language).

## Rejected cuts
- a separate `pricing` context: no rule of its own yet; revisit when discounts arrive.
```

Names are kebab-case nouns of the business (`ordering`, `claims-handling`), never technical
(`core`, `common`, `api`, `data`). In an existing project a new context is created with
`npx ddd-ts-kit generate context` (skill `ddd-ts-kit:scaffold`) once the owner agreed.

## Done when

Put this to the owner: **is each context one language and one owner, is the core named, and
is every boundary argued in one line?** On a yes, the next step is `ddd-ts-kit:glossary`.
