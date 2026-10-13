[English](event-sourcing-store-behind-repository.md) · **Français**
<!-- translation-of: event-sourcing-store-behind-repository.md sha256:2790cec1cc8acf16 -->

# ddd-ts-kit/event-sourcing-store-behind-repository

Identifiant d'architecture : `event-sourcing/store-behind-repository`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Le domaine et les cas d'usage voient un agrégat en *event sourcing* comme n'importe quel autre : chargé par son port de *repository*, changé par ses méthodes, enregistré par le même port. Un gestionnaire (handler) qui lit lui-même un flux d'événements décide de la façon dont les événements deviennent un état, ce qui est le travail de l'agrégat, et attache le cas d'usage à une technique de stockage.

## Signalé

- un import de `EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` ou `InMemoryEventStore` depuis `@ddd-ts-kit/kernel`

Incorrect :

```ts
constructor(private readonly store: EventStore) {}
```

Correct :

```ts
constructor(private readonly records: AttendanceRecordRepository) {}
```

## Options

Aucune.

`rules."event-sourcing/store-behind-repository"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line event-sourcing/store-behind-repository -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Le *store* atteint par un port du projet qui l'enveloppe n'est pas reconnu : c'est alors ce port qu'il faut regarder.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des instructions d'import.
