[English](event-sourcing-state-in-apply.md) · **Français**
<!-- translation-of: event-sourcing-state-in-apply.md sha256:08fa13535cd9d1e5 -->

# ddd-ts-kit/event-sourcing-state-in-apply

Identifiant d'architecture : `event-sourcing/state-in-apply`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/aggregates/` d'un contexte, tests exclus : les classes qui étendent `EventSourcedAggregate`.

## Pourquoi

Un agrégat en *event sourcing* se reconstruit en rejouant ses événements à travers ses méthodes d'application (apply). Une commande qui écrit aussi l'état elle-même laisse un état qu'aucun rejeu ne reconstruit : l'agrégat se comporte d'une façon juste après la commande et d'une autre une fois rechargé.

## Signalé

- hors du constructeur, des méthodes statiques et des méthodes d'application (`apply<Fact>`, et `restore` pour un *snapshot*), une affectation ou une incrémentation qui part de `this`
- au même endroit, un appel qui modifie quelque chose de `this` (`push`, `splice`, `sort`, `set`, `add`, `delete`, `clear`...)
- dans une méthode d'application, `this.record(..)` : un rejeu enregistrerait l'événement une seconde fois

Incorrect :

```ts
noteNoShow(appointmentId: string, now: Date): void {
  this.state = { noShows: this.state.noShows + 1 };
  this.record(new NoShowNoted(this.id, now, appointmentId));
}
```

Correct :

```ts
noteNoShow(appointmentId: string, now: Date): void {
  this.record(new NoShowNoted(this.id, now, appointmentId));
}

private applyNoShowNoted(event: NoShowNoted): void {
  this.state = { noShows: this.state.noShows + 1 };
}
```

## Options

Aucune.

`rules."event-sourcing/state-in-apply"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line event-sourcing/state-in-apply -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une écriture par un alias local (`const state = this.state; state.items.push(x)`) n'est pas suivie.
- Une classe qui étend `EventSourcedAggregate` sous un autre nom (un alias, une classe de base du projet) n'est pas reconnue.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers : les écritures qu'il trouve dans le corps des méthodes d'une classe dont la superclasse s'écrit `EventSourcedAggregate`. Cette règle fait autorité.
