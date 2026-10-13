[English](ports-abstract-class.md) · **Français**
<!-- translation-of: ports-abstract-class.md sha256:1ebb5cd851088e2c -->

# ddd-ts-kit/ports-abstract-class

Identifiant d'architecture : `ports/abstract-class`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de port d'un contexte : `domain/repositories/*.repository.ts` et `application/ports/*.port.ts`.

## Pourquoi

Un port est une classe abstraite qui n'a que des membres abstraits. La classe est à la fois le contrat et le jeton d'injection : elle nomme la dépendance dans une liste de dépendances, porte son type jusqu'au constructeur, et il n'y a ni constante ni fichier de jetons à garder en accord avec elle. Un port qui contient un corps, un champ ou un constructeur est une classe de base déguisée : les adaptateurs se mettent à hériter du comportement, et un *fake* ne convient plus.

## Signalé

- une classe qui n'est pas `abstract`
- un constructeur
- un membre `private`, `protected` ou `#`
- une méthode avec un corps, une propriété avec un initialiseur, un membre qui n'est pas `abstract`
- une `interface` exportée : un port se déclare comme une classe abstraite

Incorrect :

```ts
// application/ports/payment-gateway.port.ts
export interface PaymentGateway {
  charge(invoiceId: string): Promise<void>;
}

// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository {
  constructor(protected readonly table: string) {}

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== undefined;
  }
}
```

Correct :

```ts
// application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(invoiceId: string): Promise<void>;
}

// domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

## Détails

Un port peut en étendre un autre : le `Repository<A>` du noyau, ou un port du même contexte. Un membre est permis en plus des membres abstraits : `static readonly tokenKey = '<package>.<Port>'`, un littéral de chaîne qui donne au port une seule identité quand son *package* est chargé deux fois. Une valeur qui n'est pas un port (des réglages, une connexion à la base de données) se type de la même façon, par une classe abstraite aux propriétés `abstract readonly`.

Un alias `type` exporté n'est pas signalé : la forme des données qui transitent par le port peut être un type. Une interface non exportée est laissée tranquille aussi.

## Options

Aucune.

`rules."ports/abstract-class"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line ports/abstract-class -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un membre hérité d'une classe d'un autre fichier n'est pas lu : `@Repository`, `@Gateway` et `@Adapter` refusent un port doté d'un corps au chargement du fichier.
- Un port déclaré hors des deux dossiers de ports n'est pas jugé.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers. Cette règle fait autorité pour le code.
