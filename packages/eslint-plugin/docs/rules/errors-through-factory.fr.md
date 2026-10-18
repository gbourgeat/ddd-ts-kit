[English](errors-through-factory.md) · **Français**
<!-- translation-of: errors-through-factory.md sha256:7e28f1f7f23e71fe -->

# ddd-ts-kit/errors-through-factory

Identifiant d'architecture : `errors/through-factory`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier d'un contexte, tests compris, dans un projet dont la configuration dit `"stack.refusals": "named"` ou `"factories"`. Une configuration sans cette clé a été écrite quand une erreur était une classe construite avec `new` : rien n'y est signalé.

## Pourquoi

Le code qui refuse se lit comme une phrase : `throw SlotTaken.forCalendar(calendar.id, slot.startsAt)` sous `named`, où chaque refus est une classe à lui, et `throw AppointmentError.slotTaken(calendar.id, slot.startsAt)` sous `factories`, où les refus d'un concept vivent dans une classe. La fabrique (factory) écrit une fois le code, le message et les faits. Un `new` est un refus dont le code et le message sont ce que l'appelant a bien voulu écrire.

## Signalé

- `new X(...)` où `X` est importé d'un fichier de `domain/errors/`
- sous `named` seulement, `new X(...)` où `X` est une classe du même fichier qui étend `DomainRefusal`, dans ses propres fabriques aussi : une fabrique construit le refus avec `X.refusal(message, facts)`

Incorrect, sous `named` :

```ts
import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw new SlotTaken(`The slot at ${slot.startsAt.toISOString()} is held.`);
```

Correct, sous `named` :

```ts
import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw SlotTaken.forCalendar(calendar.id, slot.startsAt);
```

Incorrect, sous `factories` :

```ts
import { SlotTakenError } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw new SlotTakenError(calendar.id, slot.startsAt);
```

Correct, sous `factories` :

```ts
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';

throw AppointmentError.slotTaken(calendar.id, slot.startsAt);
```

## Options

Aucune.

`rules."errors/through-factory"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line errors/through-factory -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une classe d'erreur est reconnue à l'endroit d'où elle est importée : une classe déclarée ailleurs que dans `domain/errors/` n'est pas vue (`naming/suffix` y garde les erreurs).
- Les erreurs du kit (`NotFoundError`, `InvariantViolation`, `ValidationError`...) sont chacune un refus au code fixe et restent construites avec `new`.
- Rien n'est corrigé : quelle fabrique remplace un constructeur est une décision. `ddd-ts-kit error-factories` écrit le plan d'une migration et l'applique.

## Avec le checker de la CLI

Tenue par ce *plugin* seul : le *checker* liste la règle et ne juge rien. Le compilateur refuse la même chose hors de la classe dès qu'elle étend `DomainRefusal` ou `ConceptError`, dont les constructeurs sont protégés.
