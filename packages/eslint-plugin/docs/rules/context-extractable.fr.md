[English](context-extractable.md) · **Français**
<!-- translation-of: context-extractable.md sha256:9c8ef03d79be6af4 -->

# ddd-ts-kit/context-extractable

Identifiant d'architecture : `context/extractable`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier d'un contexte, tests exclus ; chaque vérification à l'endroit nommé ci-dessous.

## Pourquoi

Un contexte délimité (bounded context) est une unité déployable en attente. Le déplacer dans son propre service doit changer une racine de composition et des adaptateurs, jamais du code du domaine ou de l'application. Une jointure sur la table d'un autre contexte, une variable partagée par un import ou un jeton emprunté à un autre module transforment chacun ce déplacement en réécriture.

## Signalé

Dans `infrastructure/persistence/` :

- `contextSchema('<other>')` ou `schemaNameOf('<other>')` avec le nom d'un autre contexte de la configuration
- un littéral de chaîne ou de gabarit qui se lit comme du SQL et nomme `<other_schema>.` ou `"<other_schema>".`, le schéma d'un autre contexte de la configuration

Dans tout fichier d'un contexte :

- `export let` et `export var`
- une `const` exportée qui contient `new Map`, `new Set`, `new WeakMap`, `new WeakSet`, `new Array`, un littéral de tableau ou un littéral d'objet, quand le même fichier la modifie (`push`, `set`, `add`, `delete`, une affectation à un membre, `Object.assign`, ...)

Dans `<context>.module.ts` :

- un nom importé d'un autre contexte, hors de son `published-language/`, passé à `bind`, `rebind`, `resolve`, ou à `handledBy` et `toClass` (directement ou dans la liste des dépendances)

Dans un fichier de rôle d'un projet de style déclaré (`stack.style: "declared"` ; les fichiers du tableau ci-dessous) :

- tout ce qui est importé d'un fichier de port d'un autre contexte : ses `domain/repositories/*.repository.ts` et ses `application/ports/*.port.ts`

Incorrect :

```ts
// billing/infrastructure/persistence/drizzle-invoice.repository.ts
await sql`select i.id, p.label from billing.invoices i join catalog.products p on p.id = i.product_id`;

// billing/application/ports/rate-cache.ts
export const rates = new Map<string, number>();
export function remember(currency: string, rate: number): void {
  rates.set(currency, rate);
}

// billing/billing.module.ts
import { ProductReader } from '@/contexts/catalog/application/ports/product-reader.port';
builder.query(GetPrice).public().handledBy(GetPriceHandler, [ProductReader]);

// style déclaré : billing/application/queries/get-price/get-price.handler.ts
import { ProductReader } from '@/contexts/catalog/application/ports/product-reader.port';

@QueryHandler(GetPriceQuery)
export class GetPriceHandler {
  constructor(private readonly productReader: ProductReader) {}
}
```

Correct :

```ts
// billing garde sa propre projection, alimentée par catalog.product.listed
await sql`select i.id, p.label from billing.invoices i join billing.products p on p.id = i.product_id`;

// billing/billing.module.ts
builder.bind(PriceSource).toClass(InProcessPriceSource, [QueryBus]).as('gateway');
builder.query(GetPrice).public().handledBy(GetPriceHandler, [PriceSource]);

// style déclaré : le port appartient à billing, sa gateway appelle catalog
import { PriceCatalog } from '@/contexts/billing/application/ports/price-catalog.port';

@QueryHandler(GetPriceQuery)
export class GetPriceHandler {
  constructor(private readonly priceCatalog: PriceCatalog) {}
}
```

## Détails

Le schéma d'un contexte est son nom dont les tirets deviennent des tirets bas, tel que le calcule `schemaNameOf`. Un texte se lit comme du SQL quand il contient l'un de `select`, `insert`, `update`, `delete`, `from`, `join`, `into`, `references`. L'import des éléments internes d'un autre contexte est lui-même signalé par `context/published-language-only` ; cette règle signale ce qu'on en fait.

Dans le style déclaré, il n'y a pas de fichier de module : une classe nomme les ports dont elle a besoin à côté de son décorateur, si bien que l'import d'un port est le câblage. Les fichiers de rôle sont :

| Fichier, relatif au contexte | Rôle |
|---|---|
| `application/commands/**/*.command.ts`, `application/queries/**/*.query.ts` | message |
| `application/commands/**/*.handler.ts`, `application/queries/**/*.handler.ts` | gestionnaire |
| `application/integration/handlers/**/*.integration-handler.ts` | gestionnaire d'événement d'intégration |
| `application/event-handlers/**/*.event-handler.ts`, `application/integration/publishers/**/*.publisher.ts` | réaction à un événement du domaine |
| `application/authorization/**/*.policy.ts` | politique (policy) |
| `application/scheduling/**/*.job.ts` | *job* planifié |
| `infrastructure/persistence/**/*.repository.ts`, `infrastructure/**/*.gateway.ts`, `infrastructure/**/*.adapter.ts` | adaptateur |

Les ports du même contexte, de `@ddd-ts-kit/kernel`, de `@ddd-ts-kit/auth` et du répertoire de la plateforme sont ce avec quoi un fichier de rôle se câble. Une définition d'événement d'intégration importée du langage publié d'un contexte amont (`productListedV1`) n'est pas un port et n'est pas signalée. Un fichier de module conservé dans un projet de style déclaré est jugé comme dans le style explicite, et un projet de style explicite est jugé comme avant.

## Options

Aucune.

`rules."context/extractable"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line context/extractable -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Seuls les contextes listés sous `contexts` dans `ddd-ts-kit.config.json` sont connus comme « un autre contexte ».
- Une table atteinte par un constructeur de requêtes (`knex('catalog.products')`, `.withSchema('catalog')`, un objet table Drizzle importé de l'autre contexte) n'est pas lue comme du SQL ; l'import de cet objet table est signalé par `context/published-language-only`.
- Une colonne ou un alias qui porte par hasard le nom d'un autre contexte (`catalog.id` où `catalog` est un alias) est signalé : renommez l'alias.
- Le SQL hors de `infrastructure/persistence/` n'est pas lu.
- Une transaction partagée (deux contextes qui écrivent dans une même unité de travail) n'est pas visible dans un seul fichier.
- Un conteneur exporté modifié seulement par ceux qui l'importent n'est pas vu ; un conteneur jamais modifié est pris pour une constante. `Object.freeze` n'est pas exigé.
- Dans un fichier de rôle, seuls les fichiers de port d'un autre contexte sont signalés : un port qu'un autre contexte déclare ailleurs est signalé par `context/published-language-only`, comme tout import de ses éléments internes.
- Un port d'un autre contexte réexporté par un fichier du contexte importateur n'est pas vu.
- Un port étranger qui atteint le module par la plateforme ou par le noyau partagé n'est pas vu : `dependency-cruiser` et le test généré qui démarre chaque contexte seul comblent ce manque.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et de la configuration. Cette règle fait autorité pour le code.
