**English** · [Français](lifecycle-status-through-machine.fr.md)

# ddd-ts-kit/lifecycle-status-through-machine

Architecture id: `lifecycle/status-through-machine`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/aggregates/*` of a context, specs aside, when the file imports a state machine
of `domain/state-machines/`.

## Why

A state machine says once which status follows which, and what refuses a forbidden transition.
An aggregate that also writes its status by hand keeps a second, silent copy of the lifecycle:
the diagram generated from the machine then lies, and a transition the machine forbids happens
anyway. The status is therefore only ever written from the machine, or copied from a status
already read.

## Reported

In an aggregate file that imports a `*.state-machine` module, inside a member of a class:

- an object property `status: <value>` whose value is not a call `<machine>.next(..)` or
  `<machine>.start(..)` of an imported machine, a status read from somewhere (`this.state.status`,
  `state.status`) or the variable `status`
- an assignment `<target>.status = <value>`, by the same test

Incorrect:

```ts
confirm(now: Date): void {
  if (this.state.status !== 'requested') {
    throw AppointmentError.alreadyConfirmed(this.id);
  }

  this.state = { ...this.state, changedAt: now, status: 'booked' };
}
```

Correct:

```ts
confirm(now: Date): void {
  this.state = { ...this.state, changedAt: now, status: appointmentLifecycle.next(this.state.status, 'confirm') };
}
```

## Details

The machine is any binding imported from a module whose path ends with
`state-machines/<name>.state-machine`. What the machine guarantees: `defineStateMachine` of
`@ddd-ts-kit/kernel`.

## Options

None.

`rules."lifecycle/status-through-machine"` in `ddd-ts-kit.config.json` set to `off` silences the
rule, and `// ddd-ts-kit-disable-next-line lifecycle/status-through-machine -- <reason>` silences
one line, exactly as for `ddd-ts-kit check`.

## Limits

- One file at a time: an aggregate whose state machine exists and is not imported is reported
  by `ddd-ts-kit check` alone.
- A status written through a helper function, or held in a field initializer of the class, is
  not followed.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, and also an aggregate whose
state machine exists (`domain/state-machines/<aggregate>.state-machine.ts`) and is not imported.
