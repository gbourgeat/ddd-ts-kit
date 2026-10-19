[English](errors-factory-name.md) · **Français**
<!-- translation-of: errors-factory-name.md sha256:258dda2c58b2caff -->

# ddd-ts-kit/errors-factory-name

Identifiant d'architecture : `errors/factory-name`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de production de `domain/errors/` d'un contexte, dans un projet dont la configuration dit `"stack.refusals": "named"` ou `"factories"`.

## Pourquoi

La fabrique est lue par le développeur qui refuse, le code par le client, le *mapper*, le journal d'audit et les tests. Ils doivent rencontrer les mêmes mots, et ces mots sont ceux du métier. Sous `named`, la classe dit ce qui est refusé et la fabrique ce sur quoi porte le refus : `SlotTaken.forCalendar`, jamais `SlotTakenError.create`. Sous `factories`, la fabrique dit ce qui est refusé et le code le répète : `slotTaken` et `SLOT_TAKEN`, jamais `create` et `BOOKING_FAILED`.

## Signalé

Une fabrique (factory) est une méthode statique publique d'une classe d'erreur qui appelle `refusal(...)`.

Sous `named` :

- une classe dont le nom finit par `Error` : un refus est nommé d'après ce qui est refusé (`SlotTaken`, `InsufficientFunds`), et le message propose le nom sans ce suffixe
- une fabrique dont le nom ne commence pas par `for`, `with`, `because`, `on` ou `at` suivi d'une majuscule (`forAccountId`, `withNotice`, `becauseOf`, `onDate`, `atStart`) : `slotTaken`, `create`, `format` et `onboard` sont signalés, et le message propose `for` devant le nom
- une fabrique dont le nom contient un chiffre (`forAccount2`)

Le code n'est pas lu ici : sous `named`, une classe lit son code dans le `codes.ts` de son contexte, ce que tient `errors/code-listed` du *checker*.

Incorrect, sous `named` :

```ts
export class SlotTakenError extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTakenError;

  static slotTaken(calendarId: string) {
    return SlotTakenError.refusal('The slot is already held.', { calendarId });
  }
}
```

Correct, sous `named` :

```ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal('The slot is already held.', { calendarId });
  }
}
```

Sous `factories` :

- un nom qui dit qu'une erreur est construite et non quelle règle a refusé : `create`, `make`, `of`, `from`, `build`, `new`, `error`, `failure`, `fail`, `refusal`, `refuse`, ou un nom qui contient un chiffre (`error1`)
- un code qui n'est pas un littéral de chaîne, ou qui n'est pas en constant case (majuscules et tirets bas)
- un code qui n'est pas le nom de la fabrique en constant case, seul ou avec le nom du concept avant ou après : `AppointmentError.notFound` pose `NOT_FOUND`, `APPOINTMENT_NOT_FOUND` ou `NOT_FOUND_APPOINTMENT`

Incorrect, sous `factories` :

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('BOOKING_FAILED', 'The slot is already held.', { calendarId });
}
```

Correct, sous `factories` :

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('SLOT_TAKEN', 'The slot is already held.', { calendarId });
}
```

## Options

Aucune.

`rules."errors/factory-name"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line errors/factory-name -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

Un code déjà publié sous d'autres mots ne peut pas changer. Sous `named`, rien n'a à céder : le code est écrit dans `codes.ts`, à part des noms de la classe et de ses fabriques, et un projet migré y garde ses codes publiés. Sous `factories`, renommez la fabrique d'après le code, ou gardez le nom et désactivez cette ligne avec la raison.

## Limites

- Un outil ne peut pas décider si un nom est une expression métier : seuls les noms qui ne le sont certainement pas sont refusés. Sous `factories`, `language/glossary-term` tient le nom de la classe ; sous `named`, elle ne juge pas les classes de `domain/errors/`, car un refus est une phrase et non un terme.
- Sous `factories`, le premier appel `refusal(...)` de la méthode est celui qui est lu.

## Avec le checker de la CLI

Tenue par ce *plugin* seul. Qu'un code soit unique dans son contexte relève de `errors/code-unique`, et sous `named` qu'une classe lise son code dans le `codes.ts` de son contexte relève de `errors/code-listed`, toutes deux tenues par le *checker*.
