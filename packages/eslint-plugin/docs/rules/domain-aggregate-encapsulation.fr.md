[English](domain-aggregate-encapsulation.md) · **Français**
<!-- translation-of: domain-aggregate-encapsulation.md sha256:4687616a11a48360 -->

# ddd-ts-kit/domain-aggregate-encapsulation

Identifiant d'architecture : `domain/aggregate-encapsulation` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/aggregates/` et `domain/entities/` d'un contexte, tests exclus.

## Pourquoi

Un agrégat garde ses invariants. Un constructeur public permet à n'importe qui d'en construire un invalide, une propriété publique modifiable ou un *setter* permet à n'importe qui de le changer sans la règle qui aurait dû s'exécuter.

## Signalé

- un constructeur public (les classes abstraites sont exemptées)
- une classe sans constructeur et sans classe de base
- une propriété publique qui n'est ni `readonly` ni une méthode, y compris les propriétés-paramètres `public` du constructeur et les champs `accessor`
- un accesseur `set` public, et une méthode publique `setX` dont le corps ne fait qu'affecter `this`

Incorrect :

```ts
export class Invoice {
  constructor(public status: string) {}
  setStatus(status: string): void {
    this.status = status;
  }
}
```

Correct :

```ts
export class Invoice extends AggregateRoot<string> {
  private constructor(id: string, private state: InvoiceState) {
    super(id);
  }
  static create(id: string, now: Date): Invoice {
    return new Invoice(id, { createdAt: now });
  }
  issue(at: Date): void {
    this.state = { ...this.state, issuedAt: at };
    this.record(new InvoiceIssued(this.id, at));
  }
}
```

## Détails

Une classe qui en étend une autre et ne déclare pas de constructeur hérite de la visibilité de sa base : `AggregateRoot` et `Entity` du *kernel* sont protégés.

## Options

Aucune.

`rules."domain/aggregate-encapsulation"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line domain/aggregate-encapsulation -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La visibilité d'un constructeur hérité n'est pas vérifiée (aucune information de type n'est utilisée).
- Une méthode `setX` qui fait autre chose qu'affecter est présumée exprimer une intention.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
