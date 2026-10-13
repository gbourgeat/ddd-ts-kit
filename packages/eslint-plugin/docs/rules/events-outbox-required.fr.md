[English](events-outbox-required.md) · **Français**
<!-- translation-of: events-outbox-required.md sha256:310afb4b98dd97fa -->

# ddd-ts-kit/events-outbox-required

Identifiant d'architecture : `events/outbox-required`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Publier un événement d'intégration et valider le changement d'état qu'il décrit doivent réussir ou échouer ensemble. Un gestionnaire qui parle à un *broker* fait les deux séparément : l'événement part et la transaction est annulée, ou l'inverse. Le gestionnaire écrit dans le port `IntegrationEventPublisher` ; la racine de composition le lie à l'outbox, et un relais publie ensuite.

## Signalé

- un import d'un client de *broker* : `amqplib`, `kafkajs`, `nats`, `@aws-sdk/client-sqs`, `@aws-sdk/client-sns`, `@google-cloud/pubsub`, `@ddd-ts-kit/rabbitmq` (configurable)
- un import d'un bus concret : `InMemoryEventBus`, `OutboxRelay`, `OutboxPublisher`, de n'importe quel module, imports de type seul compris
- dans `application/integration/publishers/` : un paramètre de constructeur dont le type s'appelle `...EventBus` ou `...Relay`

Incorrect :

```ts
// application/integration/publishers/invoice-issued.publisher.ts
import type { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

export class InvoiceIssuedPublisher {
  constructor(private readonly bus: RabbitMqEventBus) {}
}
```

Correct :

```ts
import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

export class InvoiceIssuedPublisher {
  constructor(private readonly publisher: IntegrationEventPublisher, private readonly ids: IdGenerator) {}
}
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques et `require()` sont lus pour les *packages* de *broker* ; les bus concrets sont reconnus par leur nom exporté, même renommés à l'import.

## Options

`[{ "brokerPackages": ["amqplib", "bullmq"] }]` remplace la liste par défaut des clients de *broker*.

`rules."events/outbox-required"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line events/outbox-required -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Que le port soit lié à un `OutboxPublisher` dans la racine de composition, et que `stack.events` vaille `outbox` dès que `stack.orm` est posé, relève de la configuration et du câblage : `ddd-ts-kit check` le tient.
- Un gestionnaire qui appelle un *broker* par un port à lui (`NotificationQueue`) n'est pas vu : le nom d'un port ne dit rien de ce qu'il y a derrière.
- Hors de `application/integration/publishers/`, un paramètre de constructeur typé `EventBus` n'est pas signalé : le type du noyau est un port, seul le *publisher* en a un plus étroit à préférer.
- Un client de *broker* qui n'est pas dans la liste est signalé par `layer/application-inward` comme un *package*, pas par cette règle.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et prend en charge le côté configuration. Cette règle fait autorité pour le code.
