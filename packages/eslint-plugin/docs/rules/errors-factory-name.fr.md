[English](errors-factory-name.md) · **Français**
<!-- translation-of: errors-factory-name.md sha256:315ae3f24362c50b -->

# ddd-ts-kit/errors-factory-name

Identifiant d'architecture : `errors/factory-name`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de production de `domain/errors/` d'un contexte, dans un projet dont la configuration dit `"stack.refusals": "factories"`.

## Pourquoi

La fabrique est lue par le développeur qui refuse, le code par le client, le *mapper*, le journal d'audit et les tests. Ils doivent rencontrer les mêmes mots, et ces mots sont ceux du métier : `slotTaken` et `SLOT_TAKEN`, jamais `create` et `BOOKING_FAILED`.

## Signalé

Une fabrique (factory) est une méthode statique publique d'une classe d'erreur qui appelle `refusal(...)`.

- un nom qui dit qu'une erreur est construite et non quelle règle a refusé : `create`, `make`, `of`, `from`, `build`, `new`, `error`, `failure`, `fail`, `refusal`, `refuse`, ou un nom qui contient un chiffre (`error1`)
- un code qui n'est pas un littéral de chaîne, ou qui n'est pas en constant case (majuscules et tirets bas)
- un code qui n'est pas le nom de la fabrique en constant case, seul ou avec le nom du concept avant ou après : `AppointmentError.notFound` pose `NOT_FOUND`, `APPOINTMENT_NOT_FOUND` ou `NOT_FOUND_APPOINTMENT`

Incorrect :

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('BOOKING_FAILED', 'The slot is already held.', { calendarId });
}
```

Correct :

```ts
static slotTaken(calendarId: string) {
  return AppointmentError.refusal('SLOT_TAKEN', 'The slot is already held.', { calendarId });
}
```

## Options

Aucune.

`rules."errors/factory-name"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line errors/factory-name -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

Un code déjà publié sous d'autres mots ne peut pas changer : renommez la fabrique d'après lui, ou gardez le nom et désactivez cette ligne avec la raison.

## Limites

- Un outil ne peut pas décider si un nom est une expression métier : seuls les noms qui ne le sont certainement pas sont refusés. `language/glossary-term` tient le nom de la classe.
- Le premier appel `refusal(...)` de la méthode est celui qui est lu.

## Avec le checker de la CLI

Tenue par ce *plugin* seul. Qu'un code soit unique dans son contexte relève de `errors/code-unique`, tenue par le *checker*.
