[English](presentation-controller-shape.md) · **Français**
<!-- translation-of: presentation-controller-shape.md sha256:400f34e4820fe1d6 -->

# ddd-ts-kit/presentation-controller-shape

Identifiant d'architecture : `presentation/controller-shape` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers `*.controller.ts` dont la classe porte `@Controller` de `@ddd-ts-kit/http`.

## Pourquoi

Un contrôleur est une route : une classe, appelée par la *pipeline* par `handle`. On trouve la classe par le nom de son fichier, on la lit d'une traite, et sa déclaration est l'unique énoncé de la route. Une seconde méthode publique est une seconde route cachée dans la première, ou une traduction qui revient à un *mapper* de requête HTTP ou à un sérialiseur.

## Signalé

- une seconde classe exportée dans le fichier d'un contrôleur
- une classe de contrôleur sans `handle` public
- toute autre méthode publique ou propriété de type fonction, statiques comprises

Incorrect :

```ts
@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', summary: 'Issue invoice', response: { status: 201, body: accepted } })
export class IssueInvoiceController {
  async execute(request: HttpRequest): Promise<IssueInvoiceAccepted> {}
  totalOf(body: IssueInvoiceBody): number {}
}
```

Correct :

```ts
@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', summary: 'Issue invoice', body, response: { status: 201, body: accepted } })
export class IssueInvoiceController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ body: IssueInvoiceBody }>): Promise<IssueInvoiceAccepted> {}
}
```

## Détails

Un fichier `*.controller.ts` qui ne déclare aucun contrôleur du kit, comme un contrôleur NestJS écrit à la main, n'est pas jugé. Les types, interfaces, constantes et fonctions non exportés peuvent se tenir à côté de la classe. Que `handle` reçoive ce que la déclaration valide et renvoie ce qu'elle déclare, c'est le compilateur qui le vérifie, sur le décorateur.

## Options

Aucune.

`rules."presentation/controller-shape"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line presentation/controller-shape -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
