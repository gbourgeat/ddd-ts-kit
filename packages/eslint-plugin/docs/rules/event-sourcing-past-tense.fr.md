[English](event-sourcing-past-tense.md) · **Français**
<!-- translation-of: event-sourcing-past-tense.md sha256:d60df389a9575103 -->

# ddd-ts-kit/event-sourcing-past-tense

Identifiant d'architecture : `event-sourcing/past-tense`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/aggregates/` d'un contexte, tests exclus : les fichiers qui déclarent une classe étendant `EventSourcedAggregate`.

## Pourquoi

Un événement stocké est un fait, gardé et rejoué aussi longtemps que vit l'agrégat, lu par des personnes et par des projections qui ne sont pas encore écrites. Un nom au présent ou à l'impératif se lit comme une demande qui peut encore être refusée.

## Signalé

- un nom importé de `domain/events/`, tel que le fichier l'écrit (le nom local d'un import renommé), dont le fait ne contient aucun participe passé. Le fait est le nom qui suit le nom de l'agrégat (`ScheduledVisitCancel` de `ScheduledVisit` : `Cancel`), ou le nom entier quand il ne commence pas par lui. Un participe passé est un mot qui se termine par `-ed`, ou un participe irrégulier courant (`paid`, `held`, `taken`, `withdrawn`, `set`, `made`, `done`, `lost`, `won`...) ; un participe qui s'écrit comme son impératif (`set`, `put`, `read`, `run`, `cut`, `found`, `left`...) ne compte pas en tête du fait, où il se lit comme un ordre (`SetPrice`, `ReadInvoice`), et compte après un nom (`InvoicePriceSet`)

Incorrect :

```ts
import { NoteNoShow } from '@/contexts/scheduling/domain/events/note-no-show.event';
```

Correct :

```ts
import { NoShowNoted } from '@/contexts/scheduling/domain/events/no-show-noted.event';
```

## Options

Aucune.

`rules."event-sourcing/past-tense"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line event-sourcing/past-tense -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un mot qui se termine par `-ed` sans être un participe (`Need`, `Seed`) passe.
- Un participe irrégulier absent de la liste est signalé : désactivez cette ligne avec une raison.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant, à partir des noms que lient les instructions d'import. Les deux tiennent les mêmes listes de participes, et `generate domain-event` aussi ; un test de la CLI garde les copies identiques.
