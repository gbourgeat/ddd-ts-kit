[English](domain-value-object-immutability.md) · **Français**
<!-- translation-of: domain-value-object-immutability.md sha256:5522b9c36f5b70cf -->

# ddd-ts-kit/domain-value-object-immutability

Identifiant d'architecture : `domain/value-object-immutability` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/value-objects/` d'un contexte, tests exclus.

## Pourquoi

Un objet-valeur est sa valeur. S'il peut changer, deux détenteurs de la même instance ne sont plus d'accord sur ce qu'ils détiennent, et l'égalité par valeur ne veut plus rien dire.

## Signalé

- une propriété ou une propriété-paramètre du constructeur sans `readonly` (privées et `#private` comprises)
- un accesseur `set`
- hors du constructeur, une affectation ou une incrémentation qui part de `this` (`this.props.cents += 1`)
- hors du constructeur, une méthode de modification de tableau appelée sur quelque chose de `this` (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`)

Incorrect :

```ts
export class Amount {
  constructor(private cents: number) {}
  add(other: Amount): void {
    this.cents += other.cents;
  }
}
```

Correct :

```ts
export class Amount extends ValueObject<AmountProps> {
  add(other: Amount): Amount {
    return new Amount({ cents: this.props.cents + other.props.cents });
  }
}
```

## Options

Aucune.

`rules."domain/value-object-immutability"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line domain/value-object-immutability -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- L'immuabilité profonde de ce que contient une propriété (`readonly items: string[]`) n'est pas vérifiée : préférez `readonly string[]`.
- La modification d'une `Map`, d'un `Set` ou d'un objet par des appels de méthode n'est pas vue.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
