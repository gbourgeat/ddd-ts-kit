[English](event-sourcing-projection-never-appends.md) · **Français**
<!-- translation-of: event-sourcing-projection-never-appends.md sha256:d3f1dff5870e7a18 -->

# ddd-ts-kit/event-sourcing-projection-never-appends

Identifiant d'architecture : `event-sourcing/projection-never-appends`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `application/projections/` d'un contexte, et tout fichier d'un contexte qui déclare une classe avec `@Projection`, tests exclus.

## Pourquoi

Une projection transforme des faits en modèle de lecture et se rejoue depuis la position zéro à chaque reconstruction. Une projection qui ajoute à un flux d'événements y ajouterait de nouveau à chaque reconstruction, et fait décider des faits par le côté lecture.

## Signalé

- un import de `EventStore` ou de `EventSourcedRepository` depuis `@ddd-ts-kit/kernel`, dans toute projection
- un import de quoi que ce soit de `domain/repositories/`, dans une projection déclarée `@Projection(name, { feed: 'event-store' })`

Une projection alimentée par le répartiteur (dispatcher) peut toujours nommer un port de *repository*, comme elle le pouvait avant l'*event sourcing* : elle n'est pas rejouée depuis la position zéro, et un projet qui n'opte pas pour l'*event sourcing* ne voit aucun nouveau constat.

Incorrect :

```ts
@Projection('scheduling.attendance-history', { feed: 'event-store' })
export class AttendanceHistoryProjection {
  constructor(private readonly history: AttendanceHistory, private readonly records: AttendanceRecordRepository) {}
}
```

Correct :

```ts
@Projection('scheduling.attendance-history', { feed: 'event-store' })
export class AttendanceHistoryProjection {
  constructor(private readonly history: AttendanceHistory) {}
}
```

## Options

Aucune.

`rules."event-sourcing/projection-never-appends"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line event-sourcing/projection-never-appends -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un agrégat atteint par un port de `application/ports/` n'est pas reconnu.
- On sait qu'une projection est alimentée par le *store* seulement par le littéral `feed: 'event-store'` de son `@Projection` ; une projection branchée sur une `CatchUpSubscription` sans lui est jugée comme alimentée par le répartiteur.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des instructions d'import et du texte `@Projection(`.
