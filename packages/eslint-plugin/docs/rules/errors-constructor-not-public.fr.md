[English](errors-constructor-not-public.md) · **Français**
<!-- translation-of: errors-constructor-not-public.md sha256:900f7905c250d239 -->

# ddd-ts-kit/errors-constructor-not-public

Identifiant d'architecture : `errors/constructor-not-public`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de production de `domain/errors/` d'un contexte, dans un projet dont la configuration dit `"stack.refusals": "factories"`.

## Pourquoi

Un constructeur public permet à n'importe quel appelant de construire un refus avec un code et un message de son cru. `ConceptError` de `@ddd-ts-kit/kernel` a un constructeur protégé, et une classe qui l'étend n'en déclare aucun : un refus n'existe alors que par une fabrique statique.

## Signalé

- une classe qui en étend une autre et déclare un constructeur public
- une classe qui étend `DomainError` et ne déclare pas de constructeur : elle en hérite un public

Une classe abstraite n'est pas jugée.

Incorrect :

```ts
export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';

  constructor(calendarId: string) {
    super(`The slot on calendar ${calendarId} is already held.`);
  }
}
```

Correct :

```ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string) {
    return AppointmentError.refusal('SLOT_TAKEN', `The slot on calendar ${calendarId} is already held.`, { calendarId });
  }
}
```

## Options

Aucune.

`rules."errors/constructor-not-public"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line errors/constructor-not-public -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une classe qui étend une base du projet et ne déclare pas de constructeur est présumée correcte : la visibilité dont elle hérite est dans un autre fichier.
- Rien n'est corrigé : rendre un constructeur privé casse chaque `new` de la classe. `ddd-ts-kit error-factories` fait passer un projet entier aux fabriques.

## Avec le checker de la CLI

Tenue par ce *plugin* seul : la forme d'une classe demande un arbre syntaxique.
