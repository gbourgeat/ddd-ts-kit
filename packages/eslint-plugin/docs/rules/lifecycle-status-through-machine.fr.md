[English](lifecycle-status-through-machine.md) · **Français**
<!-- translation-of: lifecycle-status-through-machine.md sha256:a589325d42b548b2 -->

# ddd-ts-kit/lifecycle-status-through-machine

Identifiant d'architecture : `lifecycle/status-through-machine`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/aggregates/*` d'un contexte, *specs* mises à part, quand le fichier importe une
machine à états de `domain/state-machines/`.

## Pourquoi

Une machine à états dit une fois quel statut suit quel autre, et ce qui refuse une transition
interdite. Un agrégat qui écrit aussi son statut à la main garde une seconde copie, muette, du
cycle de vie : le diagramme généré depuis la machine ment alors, et une transition que la machine
interdit a lieu quand même. Le statut n'est donc jamais écrit que depuis la machine, ou recopié
d'un statut déjà lu.

## Signalé

Dans un fichier d'agrégat qui importe un module `*.state-machine`, à l'intérieur d'un membre d'une classe :

- une propriété d'objet `status: <value>` dont la valeur n'est ni un appel `<machine>.next(..)` ou
  `<machine>.start(..)` d'une machine importée, ni un statut lu ailleurs (`this.state.status`,
  `state.status`), ni la variable `status`
- une affectation `<target>.status = <value>`, selon le même test

Incorrect :

```ts
confirm(now: Date): void {
  if (this.state.status !== 'requested') {
    throw AppointmentError.alreadyConfirmed(this.id);
  }

  this.state = { ...this.state, changedAt: now, status: 'booked' };
}
```

Correct :

```ts
confirm(now: Date): void {
  this.state = { ...this.state, changedAt: now, status: appointmentLifecycle.next(this.state.status, 'confirm') };
}
```

## Détails

La machine est toute liaison importée d'un module dont le chemin se termine par
`state-machines/<name>.state-machine`. Ce que la machine garantit : `defineStateMachine` de
`@ddd-ts-kit/kernel`.

## Options

Aucune.

`rules."lifecycle/status-through-machine"` à `off` dans `ddd-ts-kit.config.json` désactive la
règle, et `// ddd-ts-kit-disable-next-line lifecycle/status-through-machine -- <reason>` désactive
une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un fichier à la fois : un agrégat dont la machine à états existe sans être importée est signalé
  par `ddd-ts-kit check` seul.
- Un statut écrit par une fonction auxiliaire, ou tenu dans l'initialiseur d'un champ de la classe,
  n'est pas suivi.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers, et aussi un agrégat
dont la machine à états existe (`domain/state-machines/<aggregate>.state-machine.ts`) sans être importée.
