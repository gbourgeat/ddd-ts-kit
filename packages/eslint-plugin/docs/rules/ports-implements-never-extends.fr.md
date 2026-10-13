[English](ports-implements-never-extends.md) · **Français**
<!-- translation-of: ports-implements-never-extends.md sha256:2a318e3c9e3a8f11 -->

# ddd-ts-kit/ports-implements-never-extends

Identifiant d'architecture : `ports/implements-never-extends`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Un adaptateur honore un contrat ; il n'en hérite pas. `implements` laisse le compilateur vérifier l'adaptateur par rapport au port et garde le port sans comportement, pour qu'un *fake*, une classe en mémoire et un client distant soient interchangeables. `extends` fait du port une classe de base et y attache chaque adaptateur.

## Signalé

- une classe portant `@Repository(Port, ..)`, `@Gateway(Port, ..)` ou `@Adapter(Port, ..)` qui n'écrit pas `implements Port`, ou qui écrit `extends Port`
- la classe donnée à `bind(Port).toClass(Class, ..)` ou à `rebind(Port).toClass(Class, ..)` qui n'implémente pas `Port`, ou qui l'étend
- sous `infrastructure/` d'un contexte : une classe qui étend (`extends`) une classe importée d'un fichier de port

Incorrect :

```ts
@Repository(InvoiceRepository, [Database])
export class KnexInvoiceRepository extends InvoiceRepository {}

builder.bind(PaymentGateway).toClass(StripePaymentGateway, [PaymentSettings]);
// où : export class StripePaymentGateway {}
```

Correct :

```ts
@Repository(InvoiceRepository, [Database])
export class KnexInvoiceRepository implements InvoiceRepository {}

export class StripePaymentGateway implements PaymentGateway {}
```

## Détails

La classe donnée à `toClass` est cherchée dans le fichier analysé, puis dans le fichier d'où elle est importée par un chemin relatif ou l'alias d'import : ce fichier est lu sur le disque et analysé sans les types. Quand elle est introuvable (une classe d'un *package*, un *barrel*, un export qui renomme), rien n'est signalé. Une classe liée à elle-même (`bind(Registry).toClass(Registry)`) n'est pas un port et n'est pas jugée. Les fichiers de port sont `domain/repositories/*.repository.ts` et `application/ports/*.port.ts`.

## Options

Aucune.

`rules."ports/implements-never-extends"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line ports/implements-never-extends -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- `implements` est comparé par nom : `implements kernel.Clock` pour un port nommé `Clock` n'est pas reconnu ; importez le port par son nom.
- Un adaptateur qui étend son port par une classe intermédiaire d'un autre fichier n'est pas vu : les décorateurs le refusent au chargement du fichier.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers. Cette règle fait autorité pour le code.
