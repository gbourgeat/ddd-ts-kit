**English** · [Français](event-sourcing-state-in-apply.fr.md)

# ddd-ts-kit/event-sourcing-state-in-apply

Architecture id: `event-sourcing/state-in-apply`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/aggregates/` of a context, tests excluded: the classes that extend `EventSourcedAggregate`.

## Why

An event-sourced aggregate is rebuilt by replaying its events through its apply methods. A command that also writes the state itself leaves a state no replay rebuilds: the aggregate behaves one way just after the command and another way once loaded.

## Reported

- outside the constructor, the static methods and the apply methods (`apply<Fact>`, and `restore` for a snapshot), an assignment or an increment that starts at `this`
- there, a mutating call on something of `this` (`push`, `splice`, `sort`, `set`, `add`, `delete`, `clear`...)
- in an apply method, `this.record(..)`: a replay would record the event again

Incorrect:

```ts
noteNoShow(appointmentId: string, now: Date): void {
  this.state = { noShows: this.state.noShows + 1 };
  this.record(new NoShowNoted(this.id, now, appointmentId));
}
```

Correct:

```ts
noteNoShow(appointmentId: string, now: Date): void {
  this.record(new NoShowNoted(this.id, now, appointmentId));
}

private applyNoShowNoted(event: NoShowNoted): void {
  this.state = { noShows: this.state.noShows + 1 };
}
```

## Options

None.

`rules."event-sourcing/state-in-apply"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line event-sourcing/state-in-apply -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A write through a local alias (`const state = this.state; state.items.push(x)`) is not followed.
- A class that extends `EventSourcedAggregate` under another name (an alias, a base class of the project) is not recognised.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files: the writes it finds in the bodies of the methods of a class whose superclass is written `EventSourcedAggregate`. This rule is the authority.
