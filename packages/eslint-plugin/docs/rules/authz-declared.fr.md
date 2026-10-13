[English](authz-declared.md) · **Français**
<!-- translation-of: authz-declared.md sha256:38d77053454decf3 -->

# ddd-ts-kit/authz-declared

Identifiant d'architecture : `authz/declared`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : le fichier de module d'un contexte pour les enregistrements, chaque fichier de production pour les routes et les messages, et, dans un projet de style déclaré (`stack.style: "declared"`), les fichiers `*.command.ts` et `*.query.ts` sous `application/commands` et `application/queries` ; tests exclus.

## Pourquoi

Rien n'est accessible par défaut. Un cas d'usage ou une route qui ne dit rien de qui peut l'appeler est ouvert par accident, et l'accident se découvre en production. Dire « public » est une décision ; ne rien dire n'en est pas une.

## Signalé

- dans `<context>.module.ts` : une chaîne `<builder>.command(X)` ou `<builder>.query(X)` qui atteint `.handledBy(...)` ou `.handledByFactory(...)` sans `.requires(...)` ni `.public()`, sauf si l'on voit que la classe `X` porte `@Requires(...)` ou `@Public()`
- dans un projet de style déclaré : une classe exportée d'un fichier `*.command.ts` ou `*.query.ts` sous `application/commands` ou `application/queries` qui ne porte ni `@Requires(...)` ni `@Public()` de `@ddd-ts-kit/kernel/declarations`
- un `defineRoute({...})` dont la spécification n'a pas de propriété `security`, ou `security: undefined`
- un `defineRoute({...})` dont la spécification a `security: []`
- une classe qui étend `AuthorizedCommand` ou `AuthorizedQuery` dont le constructeur ne passe pas l'un de ses propres paramètres comme premier argument de `super(...)`

Incorrect :

```ts
builder.command(VoidInvoice).handledBy(VoidInvoiceHandler, [INVOICES]);

defineRoute({ method: 'POST', path: '/invoices/:id/void', operationId: 'voidInvoice', responses }, handler);

export class VoidInvoice extends AuthorizedCommand {
  constructor(readonly invoiceId: string) {
    super(systemActor('billing'));
  }
}

// style déclaré : application/commands/issue-invoice/issue-invoice.command.ts
export class IssueInvoiceCommand extends AuthorizedCommand<string> {}
```

Correct :

```ts
builder.command(VoidInvoice).requires(billingPermissions['invoice.void']).handledBy(VoidInvoiceHandler, [INVOICES]);
builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [CATALOG]);

defineRoute({ method: 'POST', path: '/invoices/:id/void', operationId: 'voidInvoice', responses, security: ['bearer'] }, handler);
defineRoute({ method: 'GET', path: '/catalog', operationId: 'getCatalog', responses, security: false }, handler);

export class VoidInvoice extends AuthorizedCommand {
  constructor(actor: Actor, readonly invoiceId: string) {
    super(actor);
  }
}

// style déclaré : application/commands/issue-invoice/issue-invoice.command.ts
import { Requires } from '@ddd-ts-kit/kernel/declarations';

@Requires(billingPermissions['invoice.issue'])
export class IssueInvoiceCommand extends AuthorizedCommand<string> {}
```

## Détails

Le type de route de `@ddd-ts-kit/http` impose déjà `security` : `defineRoute` ne compile pas sans elle et refuse une liste vide. Cette règle reste le filet, au niveau du lint, pour une définition de route construite de façon lâche : une spécification typée `any` ou transtypée, un fichier JavaScript, une enveloppe qui élargit le type.

`@Requires(...)` ou `@Public()` sur la classe du message est la déclaration, dans tout projet : un module qui enregistre un message décoré sans `.requires(...)` ni `.public()` n'est pas signalé. La classe est en vue quand elle est déclarée dans le fichier de module ou importée par son nom depuis une source du projet qui existe sur le disque, laquelle est alors analysée (syntaxe seulement). Un décorateur compte quand son nom est importé de `@ddd-ts-kit/kernel/declarations` dans le fichier de la classe, sous un alias (`{ Requires as Needs }`) ou un espace de noms (`declarations.Requires`) aussi ; un `Requires` maison ne compte pas.

Un projet de style explicite n'est jugé que sur ses enregistrements : un fichier de message sans décorateur n'y est pas signalé.

L'enregistrement est reconnu à sa forme, quel que soit le nom du builder. `super(input.actor)` est accepté quand `input` est un paramètre du constructeur. Une classe sans constructeur hérite de celui de `AuthorizedCommand`, qui prend l'acteur.

## Options

Aucune.

`rules."authz/declared"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line authz/declared -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un message enregistré atteint par un *barrel*, un export qui renomme, un import par défaut ou un espace de noms n'est pas suivi jusqu'à sa classe : son décorateur n'est pas vu et l'enregistrement est signalé.
- Dans un projet de style déclaré qui garde un `<context>.module.ts`, un message qui y est enregistré avec `.requires(...)` et écrit sans décorateur est quand même signalé dans son propre fichier : mettez le décorateur sur la classe.
- Un fichier `*.command.ts` ou `*.query.ts` qui n'exporte aucune classe n'est pas signalé ici.
- Un enregistrement réparti sur plusieurs instructions (`const registration = builder.command(X); registration.handledBy(H);`) n'est pas suivi.
- Un câblage écrit à la main avec `AuthorizationMap.of(requires(...), publicUseCase(...))` n'est pas lu : `authorizationMiddleware` refuse un cas d'usage non déclaré à l'exécution, et `createApplication({ authorization: 'required' })` au démarrage.
- Un message qui étend simplement `Command` ou `Query` alors que son enregistrement appelle `.requires(...)` s'étend sur deux fichiers et n'est pas vu ici ; le compilateur le refuse, puisque `requires` n'existe que pour un message qui porte un acteur.
- Une spécification de route qui n'est pas un littéral d'objet, ou qui étale un autre objet, n'est pas jugée.
- Que le schéma nommé dans `security` existe, et que la permission soit la bonne, n'est pas vérifié.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
