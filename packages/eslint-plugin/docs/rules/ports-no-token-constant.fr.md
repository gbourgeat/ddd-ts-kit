[English](ports-no-token-constant.md) · **Français**
<!-- translation-of: ports-no-token-constant.md sha256:9657946de23c94a5 -->

# ddd-ts-kit/ports-no-token-constant

Identifiant d'architecture : `ports/no-token-constant`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Une classe de port est son propre jeton d'injection. Une constante à côté d'elle, un utilitaire `token(..)`, un symbole ou une chaîne est un second nom pour la même chose : il faut le garder en accord à la main, il perd le type, et il cache la liste des dépendances au compilateur.

## Signalé

- un appel de `token`, importé d'un *package* du kit (`@ddd-ts-kit/*`), par son nom, par un alias ou par un espace de noms
- `Symbol(..)`, `Symbol.for(..)` ou un littéral de chaîne passé comme premier argument d'un appel de liaison, et une variable déclarée comme un tel symbole passée à un tel appel
- un identifiant en majuscules séparées par des tirets bas (deux caractères au moins) dans une liste de dépendances
- un fichier nommé `*.ports.ts` ou `tokens.ts` sous la racine des sources, signalé sur sa première ligne

Incorrect :

```ts
// une constante qui tient lieu de port, dans un fichier qui les rassemble
export const invoiceRepositoryToken = Symbol('billing.InvoiceRepository');

builder.bind(invoiceRepositoryToken).toClass(KnexInvoiceRepository, [Database]);
builder.bind('clock').toValue(clock);
```

Correct :

```ts
// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository extends Repository<Invoice> {}

builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database]);
builder.bind(Clock).toValue(clock);
```

## Détails

Une liste de dépendances est le tableau qui nomme ce que reçoit un constructeur : le dernier argument d'un décorateur de déclaration de `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`, `@Repository`, `@Gateway`, `@Adapter`, `@Policy`) et le second argument de `.toClass(C, [..])` et de `.handledBy(H, [..])` de `@ddd-ts-kit/di`.

Un appel de liaison est `bind`, `rebind`, `resolve`, `fake` ou `override`, seul ou comme membre (`builder.bind(X)`, `app.resolve(X)`), et il n'est lu que dans un fichier qui importe quelque chose de `@ddd-ts-kit/di` ; `Promise.resolve`, `path.resolve`, `require.resolve` et `import.meta.resolve` ne sont jamais des appels de liaison.

## Options

Aucune.

`rules."ports/no-token-constant"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line ports/no-token-constant -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un jeton fabriqué par un utilitaire maison, ou un symbole déclaré dans un autre fichier, n'est pas suivi.
- Un nom en majuscules séparées par des tirets bas n'est signalé que dans une liste de dépendances : une constante du domaine n'importe où ailleurs n'est pas un jeton.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers. Cette règle fait autorité pour le code.
