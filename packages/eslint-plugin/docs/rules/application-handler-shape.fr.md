[English](application-handler-shape.md) · **Français**
<!-- translation-of: application-handler-shape.md sha256:39389c2ddda30de3 -->

# ddd-ts-kit/application-handler-shape

Identifiant d'architecture : `application/handler-shape` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers `*.handler.ts` sous `application/` d'un contexte.

## Pourquoi

Un gestionnaire (handler) est un cas d'usage : une classe, appelée par le bus par `execute`. Une seconde méthode publique est un second cas d'usage caché dans le premier, ou une décision métier qui revient au domaine.

## Signalé

- un fichier de gestionnaire qui n'exporte aucune classe
- une seconde classe exportée
- une classe de gestionnaire sans `execute` public
- toute autre méthode publique ou propriété de type fonction, statiques comprises

Incorrect :

```ts
export class IssueInvoiceHandler {
  async handle(command: IssueInvoiceCommand): Promise<string> {}
  computeTotal(): number {}
}
```

Correct :

```ts
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  async execute(command: IssueInvoiceCommand): Promise<string> {}
  private total(): number {}
}
```

## Détails

Les types, interfaces et constantes exportés à côté de la classe sont permis. Les fichiers `*.event-handler.ts` ne sont pas des gestionnaires du bus et ne sont pas jugés.

## Options

Aucune.

`rules."application/handler-shape"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line application/handler-shape -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La signature de `execute` n'est pas vérifiée par rapport au type de la commande ou de la requête : le compilateur le fait par `CommandHandler<T>` et `QueryHandler<T>`.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
