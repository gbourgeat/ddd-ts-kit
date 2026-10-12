# ddd-ts-kit/event-sourcing-past-tense

Architecture id: `event-sourcing/past-tense`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/aggregates/` of a context, tests excluded: the files that declare a class extending `EventSourcedAggregate`.

## Why

A stored event is a fact, kept and replayed for as long as the aggregate lives, read by people and by projections that were not written yet. A name in the present or the imperative reads as a request that may still be refused.

## Reported

- a name imported from `domain/events/`, as the file writes it (the local name of a renamed import), none of whose words is a past participle: a word ending in `-ed`, or a common irregular one (`paid`, `held`, `taken`, `withdrawn`, `set`, `made`, `done`, `lost`, `won`...)

Incorrect:

```ts
import { NoteNoShow } from '@/contexts/scheduling/domain/events/note-no-show.event';
```

Correct:

```ts
import { NoShowNoted } from '@/contexts/scheduling/domain/events/no-show-noted.event';
```

## Options

None.

`rules."event-sourcing/past-tense"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line event-sourcing/past-tense -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A word that ends in `-ed` without being a participle (`Need`, `Seed`) passes.
- An irregular participle missing from the list is reported: silence that line with a reason.

## With the CLI checker

`ddd-ts-kit check` reports the same id, from the names the import statements bind. Both hold the same list of participles.
