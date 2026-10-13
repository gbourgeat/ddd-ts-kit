**English** · [Français](naming-business-name.fr.md)

# ddd-ts-kit/naming-business-name

Architecture id: `naming/business-name`. Default severity: `error`. Fixable (`eslint --fix`) where the name is known.

Applies to: `domain/` and `application/` of every context, and the shared kernel outside its `presentation/`; tests excluded. On by default, in a new project and in an existing one: a config without `businessNames` reads the default list.

## Why

The code of the model is the ubiquitous language written down. A handler that loads an appointment and names it `target`, a loop that walks the due reminders as `item`, a parameter called `data`: each makes the reader translate the line back into the business, and hides which concept it handles. A generic name also spreads, because the next line is written by copying the last one: the command handler templates of the kit wrote `const target = X.create(..)` until 0.17, and forty handlers of the example application inherited it. Named after its concept, `appointment`, `reminder`, `delegation`, a line reads as the domain expert would say it.

## Reported

A name that is one of the generic words, `target`, `targets`, `data`, `item`, `items`, `obj`, `object`, `thing`, `things`, `stuff`, `info`, `element`, `el`, `tmp`, `temp`, `foo`, `bar` or `baz`, given to:

- a variable, `const target = ..`;
- a loop variable, `for (const target of due)`;
- a destructured binding, `const { lines: data } = command`, at any depth;
- a parameter of a function, a method, an arrow, an abstract or overload signature, a method signature of an interface, or a function type;
- a property of a class (parameter properties included), of an interface, or of a type alias of an object.

Incorrect:

```ts
const target = await this.appointmentRepository.findById(command.appointmentId);

for (const target of due) {
  target.expire(command.at);
}
```

Correct:

```ts
const appointment = await this.appointmentRepository.findById(command.appointmentId);

for (const appointment of due) {
  appointment.expire(command.at);
}
```

## The fix

A variable whose initializer says which concept it holds is renamed, with every use of it, to the name of that concept in camel case:

- `X.create(..)` and `new X(..)`, `X` a class of the file or one imported from the project (`new Map()` says nothing of the business): `const appointment = Appointment.create(..)`;
- a call on a repository: with type information (the presets of the plugin give it), the type it answers, once awaited and without `undefined`, when it is an aggregate, an entity or a value object of the project (`domain/aggregates/`, `domain/entities/`, `domain/value-objects/`, the shared kernel); `appointments` for a list. The repository is an instance of a port of `domain/repositories/`, or a binding named `<concept>Repository`. Without type information, the names decide: `this.appointmentRepository.findById(..)` (`find`, `get`, `load`, `require`, alone or with `One` or `ById`) holds an `appointment`, `findDue(..)` held by a plural word (`targets`, `items`, `things`) holds `appointments`.

A shorthand property keeps its key: `{ target }` becomes `{ target: appointment }`. The rule reports without fixing when the name is already taken (declared in the scope, shadowing between a use and the declaration, or used inside the scope for something else), when the variable is exported, and when the binding holds one element but the name says several, or the other way round. A loop variable is never fixed: the message gives the singular of its collection (`reminder` for `dueReminders`, or the element type with type information).

Upgrading a project is one command, then the reports that remain:

```bash
npx eslint . --fix
npx eslint .
```

## Details

A key of an object literal follows the type it is written for and is not judged: `{ items, total }` is the shape of a `Page` of the kernel. A type literal nested in an annotation, `props: { data: string }`, is not a declaration of the model either. A catch clause is not judged.

## Options

`words`: the generic words, in place of the default list. `allow`: words removed from the list.

```js
'ddd-ts-kit/naming-business-name': ['error', { allow: ['info'] }]
```

Both options come over `businessNames` of `ddd-ts-kit.config.json`, `{ "words": [..], "allow": [..] }`, which `ddd-ts-kit check` reads too: keep the list there so that both analyzers judge the same names. `rules."naming/business-name"` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line naming/business-name -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Infrastructure, presentation, the platform and the tests are not judged: an adapter speaks the words of its library, and a spec the words of its scenario. A serializer of `presentation/` is still better named after what it serializes.
- A generic word inside a longer name (`targetDate`, `itemCount`) is not reported: it is qualified. `language/no-technical-name` judges the names of classes and use cases.
- Without type information, a repository whose method names neither one element nor several (`save`, `search`, `count`) gets no proposal.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, with the same list and the same places, and proposes the name of the class an initializer builds or of the repository it reads. This rule is the authority, and the one that renames.
