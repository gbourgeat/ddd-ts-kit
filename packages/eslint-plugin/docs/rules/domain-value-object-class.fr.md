[English](domain-value-object-class.md) · **Français**
<!-- translation-of: domain-value-object-class.md sha256:4dc4fe2b91c662f7 -->

# ddd-ts-kit/domain-value-object-class

Identifiant d'architecture : `domain/value-object-class`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : un projet dont la configuration dit `"stack.values": "classes"`, ce qu'écrit
`init` (une configuration qui ne le dit pas vaut `free`, et la règle se tait :
[CONFIG.md](../../../../docs/CONFIG.fr.md#stack) donne les étapes pour la faire évoluer). Là, les
fichiers d'objets-valeurs, `domain/value-objects/*` d'un contexte et les `*.vo.ts` du noyau
partagé hors de son `presentation/`, et chaque autre fichier de `domain/` d'un contexte et du
noyau partagé hors de son `presentation/`, *specs* à part.

## Pourquoi

Une valeur du modèle est une classe qui étend `ValueObject` de `@ddd-ts-kit/kernel`, jamais une
fonction qui construit un objet simple. La classe donne ce que la fonction ne peut pas donner :

- **l'égalité sans identité** : `equals` compare les props, deux valeurs égales sont
  interchangeables ;
- **les invariants vérifiés une fois** : le constructeur est privé, la fabrique statique est la
  seule entrée, si bien qu'une valeur qui existe est valide et qu'aucun appelant ne la valide à
  nouveau ;
- **le comportement à côté des données** : `add`, `overlaps`, `isWithin` sont des méthodes du
  type qu'elles concernent, pas des fonctions utilitaires répétées partout où deux champs se
  rencontrent ;
- **les refus depuis les fabriques statiques** : `Money.of(..)` lève (ou renvoie) le refus du
  concept, `InvoiceError.invalidAmount(..)` ;
- **l'immuabilité** : les props sont figées, une opération renvoie une nouvelle instance ;
- **`instanceof` dans les *mappers* de la frontière** : un *mapper* ou un sérialiseur reconnaît
  la valeur et l'écrit, ce qu'un objet structurel ne permet jamais.

## Signalé

Dans un fichier d'objet-valeur :

- aucune classe exportée, ou une seconde ;
- une classe exportée qui n'étend ni `ValueObject` ni un autre objet-valeur du projet (une
  classe du même fichier qui l'étend, ou une classe importée d'un fichier d'objet-valeur) ;
- un constructeur public, déclaré sans `private` ni `protected` (une classe qui n'en déclare
  aucun hérite du constructeur protégé de `ValueObject`) ;
- une classe concrète sans méthode statique non privée : rien ne peut la construire ;
- une fonction exportée, une constante exportée liée à une fonction fléchée ou à une expression
  de fonction, et un objet littéral exporté (entre parenthèses, `as const` et `satisfies`
  compris), qu'il soit exporté en ligne, par une liste d'export (`export { zero }`) ou par
  défaut.

Les types et les interfaces exportés de ses props sont permis.

Dans les autres fichiers de `domain/` et du noyau partagé : une fonction exportée (déclarée, liée
à une constante, exportée par une liste ou par défaut) qui renvoie un **enregistrement de
données**, dans l'expression d'une fonction fléchée ou dans un `return` de son propre corps.
Chaque entrée de l'objet littéral est lue pour ce qu'elle contient :

| Entrée | Se lit comme | Exemples |
|---|---|---|
| un littéral, un paramètre, une opération sur eux, un appel du langage | donnée | `amount`, `'EUR'`, `cents * 100`, `Math.round(cents)`, `new Date(at)` |
| tout autre appel ou `new`, ou un nom lié à l'un d'eux dans le module | construit par le modèle | `Money.of(1)`, `total.add(tax)`, `new Slot(..)` |
| une fonction, une méthode, ou un nom lié à l'une d'elles dans le module | comportement | `isSatisfiedBy: (x) => ..`, `describe() {}`, `{ isSatisfiedBy }` |
| `...state` | dérivé | `{ ...state, status }` |

L'objet est un enregistrement de données, et la fonction est signalée, quand il contient des
données, rien de construit par le modèle et aucune décomposition (spread). Une fonction qui
déclare un type de retour d'un *package* (`): EventStamp` du noyau) n'est pas jugée : la forme
appartient à la bibliothèque.

Incorrect :

```ts
// domain/value-objects/money.vo.ts
export type Money = { readonly amount: number; readonly currency: string };

export const money = (amount: number, currency: string): Money => ({ amount, currency });
```

Correct :

```ts
// domain/value-objects/money.vo.ts (npx ddd-ts-kit generate value-object billing Money)
import { ValueObject } from '@ddd-ts-kit/kernel';

export type MoneyProps = { readonly amount: number; readonly currency: string };

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static of(amount: number, currency: string): Money {
    if (!Number.isInteger(amount)) {
      throw InvoiceError.invalidAmount(amount);
    }

    return new Money({ amount, currency });
  }

  add(other: Money): Money {
    return Money.of(this.props.amount + other.props.amount, this.props.currency);
  }
}
```

## Détails

Ce qui n'est pas signalé :

```ts
// une machine à états : le résultat d'un appel, pas une fonction
export const invoiceLifecycle = defineStateMachine({ states: ['draft', 'issued'] /* .. */ });

// un service du domaine : une classe
export class InvoiceTotalService {
  total(lines: readonly Money[]): Money { /* .. */ }
}

// une spécification : un booléen, ou seulement des fonctions, littérales ou fermetures locales
export const isOverdue = (invoice: Invoice, now: Date): boolean => invoice.dueAt < now;
export const dueBefore = (day: Date) => {
  const isSatisfiedBy = (invoice: Invoice): boolean => invoice.dueAt < day;

  return { isSatisfiedBy };
};

// une opération du modèle : des objets-valeurs qu'elle construit
export const split = (total: Money) => ({ first: Money.of(1), rest: total.subtract(Money.of(1)) });

// un reducer : dérive un enregistrement qui existe
export const evolve = (state: InvoiceState, status: string): InvoiceState => ({ ...state, status });
```

Ce qui est signalé, et décidé ainsi :

```ts
// une décision renvoyée en enregistrement : levez le refus depuis une fabrique
// (`throw InvoiceError.refused(reason)`), ou faites-en un objet-valeur (`Decision.refused(reason)`)
export const decide = (reason: string) => ({ kind: 'refused' as const, reason });

// un enregistrement de données avec des fermetures : une valeur qui a un comportement, donc une classe
export const money = (cents: number) => ({ cents, doubled: (): number => cents * 2 });

// un enregistrement qui ne fait que rassembler des paramètres, objets-valeurs compris : une paire
// qui a un sens est une valeur qui a un nom
export const period = (start: Instant, end: Instant) => ({ start, end });
```

## Options

Aucune.

`rules."domain/value-object-class"` à `warn` ou `off` dans `ddd-ts-kit.config.json` assouplit la
règle, et `// ddd-ts-kit-disable-next-line domain/value-object-class -- <reason>` désactive une
ligne, exactement comme pour `ddd-ts-kit check`. La règle vaut `error` par défaut : l'assouplir
est une dérogation, enregistrée sous `deviations` avec l'ADR qui dit pourquoi et jusqu'à quand
(`governance/recorded-deviation`). Un projet qui n'est pas prêt pour la règle garde plutôt
`"stack.values": "free"`, ce qui n'enregistre rien.

## Limites

La règle lit le texte et la syntaxe d'un fichier, sans les types. Ce qu'elle ne suit pas :

- un objet d'abord construit dans une variable, puis renvoyé (`const value = { .. }; return value;`) ;
- un objet renvoyé à travers une condition (`cond ? { .. } : { .. }`), dans un tableau, ou comme
  argument d'un appel ;
- un nom est résolu par sa première déclaration dans le module, quelle que soit sa portée : un
  paramètre nommé comme une fonction du module se lit comme cette fonction ;
- un appel est lu par le nom dont il part : `name.trim()` sur un paramètre se lit comme construit
  par le modèle, si bien qu'un enregistrement qui le contient n'est pas signalé ;
- l'exemption des *packages* lit le nom par lequel commence le type de retour déclaré, pas un
  type inféré ;
- une classe parente importée d'un fichier d'objet-valeur est tenue pour sûre : ce fichier est
  jugé de son côté.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers, avec la même table
de fichiers.
