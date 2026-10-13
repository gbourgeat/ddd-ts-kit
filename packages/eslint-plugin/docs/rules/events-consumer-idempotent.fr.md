[English](events-consumer-idempotent.md) · **Français**
<!-- translation-of: events-consumer-idempotent.md sha256:1b3f1042f11ef75d -->

# ddd-ts-kit/events-consumer-idempotent

Identifiant d'architecture : `events/consumer-idempotent`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier d'un contexte, tests exclus ; le `subscribe` direct seulement dans `application/` et dans le fichier de module.

## Pourquoi

La livraison se fait au moins une fois. Un consommateur sans nom stable ni magasin des événements traités traite une seconde fois un événement livré à nouveau : la facture est émise deux fois. Le nom est la portée d'idempotence, il est donc écrit une fois et jamais dérivé.

## Signalé

- `<builder>.on(definition)` ou `<builder>.on(definition, {})` suivi de `.handledBy(...)` ou de `.handledByFactory(...)`, sans `consumer` (une chaîne vide compte comme absente)
- `on(definition, handler)` de `@ddd-ts-kit/events` dont le troisième argument ne porte pas à la fois `consumer` et `processed`
- dans `application/` et le fichier de module : un `.subscribe(...)` direct dont le gestionnaire n'est pas enveloppé par `idempotent(...)`
- dans un projet de style déclaré (`stack.style: "declared"`) : une classe qui porte `@IntegrationEventHandler(...)` de `@ddd-ts-kit/kernel/declarations` dont les options n'écrivent pas `consumer` comme un littéral de chaîne non vide (absent, vide, une variable, un gabarit avec une substitution, des options contenues dans une variable ou seulement étalées)

Incorrect :

```ts
builder.on(productListedV1).handledBy(ProductListedHandler, [CommandBus]);

subscribeAll(platform.subscriber, [on(productListedV1, (event) => consumer.handle(event))]);

resolve(IntegrationEventSubscriber).subscribe('catalog.product.listed', (event) => consumer.handle(event));

// style déclaré
@IntegrationEventHandler(productListedV1, { consumer: consumerName }, [CommandBus])
export class CatalogProductListedHandler {}
```

Correct :

```ts
builder.on(productListedV1, { consumer: 'billing.price-list' }).handledBy(ProductListedHandler, [CommandBus]);

subscribeAll(platform.subscriber, [
  on(productListedV1, (event) => consumer.handle(event), { consumer: 'billing.price-list', processed: platform.persistence.processedEvents }),
]);

// style déclaré
@IntegrationEventHandler(productListedV1, { consumer: 'billing.catalog-product-listed' }, [CommandBus])
export class CatalogProductListedHandler {}
```

## Détails

`on` est reconnu par son import depuis `@ddd-ts-kit/events`, sous n'importe quel nom local ; `builder.on` par la chaîne qui se termine par un gestionnaire, ce qui le distingue du `on` d'un émetteur d'événements. `consume` exige les deux options par son type et n'est pas jugé. `subscribe(type, idempotent(name, store, handler))` est accepté : `idempotent` du noyau est ce sur quoi `on` et `consume` sont construits.

Dans un projet de style déclaré, une classe de gestionnaire d'événement d'intégration est son propre enregistrement : `@IntegrationEventHandler(definition, { consumer: '<context>.<reaction>' }, [ports])` satisfait la règle et rien n'a à être écrit dans un fichier de module. Le décorateur compte quand son nom est importé de `@ddd-ts-kit/kernel/declarations` dans le fichier, sous un alias ou un espace de noms aussi. Un fichier de module conservé dans un projet de style déclaré est jugé comme dans le style explicite. Dans un projet de style explicite, le décorateur n'est pas lu.

## Options

Aucune.

`rules."events/consumer-idempotent"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line events/consumer-idempotent -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Des options contenues dans une variable ou étalées depuis un autre objet ne sont pas suivies : rien n'est signalé comme manquant.
- Que le nom du consommateur soit unique et stable dans le temps n'est pas vérifié ici : ESLint juge un fichier à la fois, et deux `@IntegrationEventHandler`, ou un décorateur et un enregistrement de module, vivent dans deux fichiers. `ddd-ts-kit check` compare les noms de tout le projet, décorateurs compris, et `createApplication` refuse un nom déclaré deux fois pour le même événement.
- Qu'un fichier `*.integration-handler.ts` porte bien `@IntegrationEventHandler` est l'affaire de `declarations-role-declared`, qui signale aussi le `consumer` non écrit.
- Que le magasin soit transactionnel, ou que la marque soit validée avec le gestionnaire, n'est pas vérifié : préférez `consume`, ou passez `unitOfWork`.
- Tout `.subscribe(...)` dans `application/` ou dans le fichier de module est pris pour un abonnement à des événements, quel que soit le récepteur.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
