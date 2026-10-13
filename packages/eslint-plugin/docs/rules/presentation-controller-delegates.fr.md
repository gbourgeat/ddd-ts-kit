[English](presentation-controller-delegates.md) · **Français**
<!-- translation-of: presentation-controller-delegates.md sha256:f291428e18fa7ced -->

# ddd-ts-kit/presentation-controller-delegates

Identifiant d'architecture : `presentation/controller-delegates` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers `*.controller.ts` d'un contexte dont la classe porte `@Controller` de `@ddd-ts-kit/http`.

## Pourquoi

Un contrôleur ne porte aucune logique métier, et le moyen de l'en garder est de ne rien lui donner pour décider. Ce qu'on peut lui donner, c'est le bus de sa méthode, un *mapper* de requête HTTP et un sérialiseur. Avec un *repository*, un port ou un service du domaine dans son constructeur, une règle s'écrirait à la frontière, là où un *job* ou un gestionnaire d'événement qui appelle le même cas d'usage ne passe pas.

## Signalé

- un paramètre du constructeur typé par autre chose que `CommandBus`, `QueryBus`, une classe nommée `*Mapper` ou une classe nommée `*Serializer`
- un contrôleur `POST`, `PUT`, `PATCH` ou `DELETE` qui reçoit le `QueryBus`, et un contrôleur `GET` ou `HEAD` qui reçoit le `CommandBus`
- un contrôleur qui ne reçoit pas le bus de sa méthode

Incorrect :

```ts
@Controller({ group: InvoicesRoutes, method: 'GET', path: '/:invoiceId', summary: 'Get invoice', response: { status: 200, body: answer } })
export class GetInvoiceController {
  constructor(
    private readonly commands: CommandBus,
    private readonly invoices: InvoiceRepository,
  ) {}
}
```

Correct :

```ts
@Controller({ group: InvoicesRoutes, method: 'GET', path: '/:invoiceId', summary: 'Get invoice', response: { status: 200, body: answer } })
export class GetInvoiceController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: GetInvoiceSerializer,
  ) {}
}
```

## Détails

La méthode est lue dans le littéral de chaîne de la déclaration ; une déclaration construite ailleurs n'est jugée que sur ses dépendances. Un contrôleur sans constructeur est signalé pour le bus manquant.

## Options

Aucune.

`rules."presentation/controller-delegates"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line presentation/controller-delegates -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Le corps de `handle` n'est pas lu : un contrôleur qui calcule dans `handle` ce qu'un cas d'usage devrait décider n'est pas vu. Les dépendances dont il aurait besoin pour quoi que ce soit de sérieux, elles, le sont.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car le constructeur d'une classe demande un arbre syntaxique.
