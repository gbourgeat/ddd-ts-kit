[English](other-brokers.md) · **Français**
<!-- translation-of: other-brokers.md sha256:c5279eaa3f23e47d -->

# Le même fournisseur sur d'autres *brokers*

Ce que doit un fournisseur d'événements d'intégration, quel que soit le *broker*, et où en est
chacun : Kafka, NATS JetStream et Redis Streams sont des *packages* du kit, tenus à ce à quoi
`RabbitMqEventBus` est tenu ; SQS/SNS est une esquisse, sans code ni dépendances.

| *Broker* | Statut | Où |
|---|---|---|
| RabbitMQ | *package* | [`@ddd-ts-kit/rabbitmq`](../README.fr.md) |
| Kafka | *package* | [`@ddd-ts-kit/kafka`](../../kafka/README.fr.md) |
| NATS JetStream | *package* | [`@ddd-ts-kit/nats`](../../nats/README.fr.md) |
| Redis Streams (Redis, Dragonfly, Valkey) | *package* | [`@ddd-ts-kit/redis`](../../redis/README.fr.md), point d'entrée `./event-bus` |
| SQS et SNS | esquisse, rien de construit | ci-dessous |

![Ce que doit tout fournisseur : le relais de l'outbox appelle publish et ne marque un enregistrement publié que lorsque la promesse se résout, c'est-à-dire quand le broker a accusé réception de chaque événement ; le broker garde un abonnement par consommateur ; chaque consommateur reçoit l'événement au moins une fois, son gestionnaire s'exécute par consume avec un store d'événements traités, et le fournisseur accuse réception après la résolution du gestionnaire ; un échec revient après un délai, un nombre borné de fois, puis l'événement est garé dans une destination morte qu'un opérateur peut lire et rejouer](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/other-brokers-what-a-provider-owes.fr.svg)

## Ce que doit tout fournisseur

Deux ports de `@ddd-ts-kit/kernel`, rien d'autre :

- `IntegrationEventPublisher.publish(events)` : se résout seulement quand le *broker* a pris la
  responsabilité de **chaque** événement (son accusé de réception durable), rejette sinon, et ne
  met rien en tampon pour plus tard. Le relais de l'outbox marque un enregistrement publié sur
  cette promesse.
- `IntegrationEventSubscriber.subscribe(type, handler)` : livre chaque événement du type au
  gestionnaire (handler) au moins une fois, accuse réception après la résolution du
  gestionnaire, jamais avant, et renvoie une `Subscription`. Le nom du consommateur vient de
  l'instance (`forConsumer(name)` ou une option), parce que le port n'a pas de place pour lui.

Et une suite : `eventBusContract(runner, { name, createBus })` de
`@ddd-ts-kit/testing/contracts`, où `createBus` renvoie `{ bus, settle, close }`. `settle` se
résout une fois que tout ce qui a été publié a été livré ou abandonné ; `close` libère la
connexion et retire ce que le test a créé. La suite vérifie : la livraison par type, à chaque
abonné, de chaque événement d'un lot ; un événement auquel personne n'est abonné est accepté ; le
désabonnement arrête la livraison ; l'enveloppe revient exactement telle que publiée, avec
`traceparent`, `correlationId` et `tenantId`, et sans inventer de trace ni de corrélation quand
aucune n'a été publiée ; un gestionnaire en échec n'affame pas les autres et l'événement revient.

<!-- checked sample -->
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventBus } from '@ddd-ts-kit/kernel';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';

// Ce que fournit votre support de test : un bus sur une topologie neuve, et comment l'attendre et le jeter.
interface TestBroker {
  readonly bus: EventBus;
  settled(): Promise<void>;
  dispose(): Promise<void>;
}

declare function connectTestBroker(url: string): Promise<TestBroker>;

const url = process.env['MY_BROKER_TEST_URL'];

describe.skipIf(url === undefined)('against a real broker', () => {
  eventBusContract({ describe, it, expect, beforeEach, afterEach }, {
    name: 'MyBrokerEventBus',
    async createBus() {
      const broker = await connectTestBroker(url ?? '');

      return { bus: broker.bus, settle: () => broker.settled(), close: () => broker.dispose() };
    },
  });
});
```

En plus du contrat, les comportements pour lesquels écrire un test, avec un vrai *broker* et un
saut quand son URL est absente : publication rejetée quand l'accusé de réception ne vient pas ;
nouvelle livraison après un échec ; passage en file de rejet (dead letter) après les tentatives
bornées ; message empoisonné ; deux consommateurs reçoivent chacun tout, tandis que deux instances
d'un même consommateur se partagent les messages ; reconnexion ; fermeture propre.

Décisions communes, les mêmes partout :

- le corps est l'enveloppe en JSON ; le type, la version, l'identifiant de l'événement,
  `traceparent` et l'identifiant de corrélation sont répétés dans des en-têtes ou des attributs
  pour le routage et le traçage ;
- les erreurs sont remontées par code, jamais par message ;
- les nouvelles tentatives sont bornées et différées, puis le message est garé là où un
  opérateur peut le voir et le rejouer ;
- les consommateurs dédupliquent, par un `@IntegrationEventHandler` déclaré (ou `consume` à la
  main) et un store d'événements traités : chacun de ces *brokers* livre de nouveau.

La forme d'un fournisseur, réduite à ces devoirs. `BrokerClient` tient lieu de bibliothèque
cliente du *broker* ; un vrai fournisseur ajoute ce que portent les *packages* : la topologie, la
reconnexion, le crochet `onFailure`, les messages empoisonnés et une fermeture propre.

<!-- checked sample -->
```ts
import type { EventBus, EventDelivery, IntegrationEvent, IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';

interface OutgoingMessage {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

interface ReceivedMessage {
  readonly body: string;
  readonly receiveCount: number; // compté par le broker, ou porté dans un en-tête
  ack(): Promise<void>;
  retryAfter(delayMs: number): Promise<void>;
  park(reason: string): Promise<void>; // vers la destination morte, lisible et rejouable
}

interface BrokerClient {
  /** Se résout une fois que le broker détient durablement chaque message : son accusé de réception. */
  send(messages: readonly OutgoingMessage[]): Promise<void>;
  receive(queue: string, onMessage: (message: ReceivedMessage) => Promise<void>): () => void;
}

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5_000;

export class MyBrokerEventBus implements EventBus {
  constructor(
    private readonly client: BrokerClient,
    private readonly consumer: string, // le port n'a pas de place pour lui : il vient de l'instance
  ) {}

  /** Se résout seulement quand le broker a pris chaque événement ; rejette sinon, et ne met rien en tampon. */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    await this.client.send(events.map((event) => ({ body: JSON.stringify(event), headers: headersOf(event) })));
  }

  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    const queue = `${this.consumer}-${type}`;
    const stop = this.client.receive(queue, async (message) => {
      const delivery: EventDelivery = {
        attempt: message.receiveCount,
        maxAttempts: MAX_ATTEMPTS,
        system: 'my-broker',
        destination: queue,
        consumer: this.consumer,
      };

      try {
        await handler(JSON.parse(message.body) as IntegrationEvent, delivery);
        await message.ack(); // après la résolution du gestionnaire, jamais avant
      } catch {
        await (message.receiveCount >= MAX_ATTEMPTS ? message.park('max-attempts') : message.retryAfter(RETRY_DELAY_MS));
      }
    });

    return { unsubscribe: stop };
  }
}

/** Répétés hors du corps, pour le routage et le traçage sans avoir à l'analyser. */
function headersOf(event: IntegrationEvent): Record<string, string> {
  return {
    'x-event-id': event.id,
    'x-event-type': event.type,
    'x-event-version': String(event.version),
    ...(event.traceparent === undefined ? {} : { traceparent: event.traceparent }),
    ...(event.correlationId === undefined ? {} : { 'x-correlation-id': event.correlationId }),
    ...(event.tenantId === undefined ? {} : { 'x-tenant-id': event.tenantId }),
  };
}
```

La conversion de type du corps est l'endroit où un vrai fournisseur vérifie d'abord l'enveloppe
(`id`, `type`, `version`, `occurredAt`) et gare comme empoisonné ce qui échoue, avant qu'aucun
gestionnaire ne le voie.

## Les concepts, sur RabbitMQ

Les tableaux ci-dessous font correspondre chaque concept de `RabbitMqEventBus` à un autre
*broker*. Sur RabbitMQ, pour `forConsumer('billing')` abonné à `ordering.order.placed` (la
[topologie](../README.fr.md#topologie) et le
[comportement des nouvelles tentatives](../README.fr.md#comportement-des-nouvelles-tentatives-et-de-la-file-de-rejet)
donnent le détail) :

| Concept | RabbitMQ |
|---|---|
| *exchange* | l'*exchange* de type *topic* `integration-events`, durable |
| clé de routage | le type de l'événement, `ordering.order.placed` |
| confirmation de publication | `publish` se résout une fois que le *broker* a confirmé chaque message du lot |
| file d'attente par consommateur | la file *quorum* `billing.ordering.order.placed`, liée avec la clé de routage |
| accusé de réception manuel | accusé de réception après la résolution de chaque gestionnaire de la file |
| file de nouvelle tentative | `billing.ordering.order.placed.retry`, dont le TTL des messages vaut `retry.delayMs`, qui renvoie par *dead-lettering* vers la file de travail |
| file morte | `billing.ordering.order.placed.dead`, sans consommateur |
| `x-attempt` | l'en-tête que le bus incrémente à chaque copie envoyée à la file de nouvelle tentative |
| identifiant de déduplication | la propriété `messageId`, réglée sur l'identifiant de l'événement ; le *broker* ne déduplique pas, le store d'événements traités le fait |

## Kafka

Construit : [`@ddd-ts-kit/kafka`](../../kafka/README.fr.md), qui fait référence pour ses options,
ses garanties et ses limites. Comment les concepts du fournisseur RabbitMQ se transposent, pour
`forConsumer('billing')` abonné à `ordering.order.placed` :

| Concept ici | Kafka, tel que le *package* le fait |
|---|---|
| *exchange* et clé de routage | un *topic* par type d'événement, nommé d'après le type (`topicOf` en donne plutôt un par contexte producteur) ; la **clé d'enregistrement** est `keyOf(event)`, la clé d'ordre |
| confirmation de publication | producteur idempotent avec `acks=all` ; `publish` se résout sur l'accusé de réception de chaque enregistrement |
| file d'attente par consommateur | le groupe de consommateurs `billing`, qui commence au plus ancien enregistrement |
| accusé de réception manuel | *offset* validé après la résolution des gestionnaires, jamais automatiquement |
| file de nouvelle tentative | aucune : un enregistrement en échec est retenté **sur place**, sa partition mise en pause pendant `retry.delayMs`, si bien que l'ordre d'une clé tient à travers un échec qui se résorbe |
| file morte | le *topic* de rejet `billing.ordering.order.placed.dead` (`<consumer>.<topic>.dead`) |
| `x-attempt` | compté par le consommateur, écrit comme en-tête sur l'enregistrement de rejet |
| identifiant de déduplication | l'en-tête `x-event-id` ; le producteur idempotent n'absorbe que les nouvelles tentatives du client, le store d'événements traités reste donc nécessaire |

## NATS JetStream

Construit : [`@ddd-ts-kit/nats`](../../nats/README.fr.md), la référence pour ses options, ses
garanties et ses limites. NATS de base n'a aucune persistance : seul JetStream convient aux
ports. Pour `forConsumer('billing')` abonné à `ordering.order.placed` :

| Concept ici | JetStream, tel que le *package* le fait |
|---|---|
| *exchange* | le *stream* `integration-events` qui capture les sujets `events.>`, rétention par limites, stockage sur fichier |
| clé de routage | le sujet `events.ordering.order.placed` (`<subjectPrefix>.<event type>`) |
| confirmation de publication | l'accusé de réception de publication du *stream*, attendu pour chaque message |
| file d'attente par consommateur | le consommateur *pull* durable `billing_ordering_order_placed` : nom du consommateur et type, chaque caractère hors de `[A-Za-z0-9_-]` remplacé par `_` |
| accusé de réception manuel | accusé de réception explicite après la résolution des gestionnaires |
| file de nouvelle tentative | aucune : `nak` avec `retry.delayMs`, le serveur livre de nouveau |
| file morte | le sujet `dead.events.billing.ordering.order.placed` (`dead.<subjectPrefix>.<consumer>.<event type>`) gardé par le *stream* `integration-events-dead` ; le bus publie la copie, attend son accusé de réception, puis termine l'original |
| `x-attempt` | le compteur de livraisons du serveur |
| identifiant de déduplication | l'en-tête `Nats-Msg-Id`, réglé sur l'identifiant de l'événement : le *stream* écarte une seconde publication à l'intérieur de sa fenêtre de doublons (2 minutes), ce qui absorbe une nouvelle tentative du relais, pas un rejeu une heure plus tard |

## Redis Streams

Construit : [`@ddd-ts-kit/redis`](../../redis/README.fr.md#bus-dévénements-sur-redis-streams),
point d'entrée `./event-bus`, la référence pour ses options, ses garanties et ses limites ; il
tourne sur Redis, Valkey et Dragonfly. Pour `forConsumer('billing')` abonné à
`ordering.order.placed` :

| Concept ici | Redis Streams, tel que le *package* le fait |
|---|---|
| *exchange* | aucun : un *stream* par type d'événement |
| clé de routage | le *stream* `integration-events:ordering.order.placed` (`<prefix>:<event type>`) |
| confirmation de publication | l'identifiant d'entrée que le serveur renvoie pour chaque `XADD`, tout un lot dans un seul `MULTI` |
| file d'attente par consommateur | le groupe de consommateurs `billing` sur ce *stream* ; les instances de `billing` sont membres du groupe et se partagent ses entrées |
| accusé de réception manuel | `XACK` après la résolution des gestionnaires |
| file de nouvelle tentative | aucune : une entrée en échec reste en attente dans le groupe et est réclamée de nouveau (`XCLAIM`) une fois inactive depuis `retry.delayMs` |
| file morte | le *stream* `integration-events:ordering.order.placed:billing:dead`, la copie et le `XACK` dans un seul script |
| `x-attempt` | le compteur de livraisons de la liste des entrées en attente, un de plus à chaque réclamation |
| identifiant de déduplication | aucun côté publication ; l'option `deduplication.windowMs` réduit la fenêtre d'une nouvelle tentative du relais, et les consommateurs dédupliquent toujours |

## SQS et SNS

![L'esquisse d'un fournisseur sur SQS et SNS : le relais de l'outbox publie vers un seul topic SNS avec le type de l'événement en attribut de message ; chaque abonnement a une politique de filtre sur type et livre des messages bruts à une file SQS par consommateur et par type, billing-ordering_order_placed et notifications-ordering_order_placed (les points du type remplacés, car SQS les refuse dans un nom de file) ; le consommateur interroge sa file en long polling et supprime un message après la résolution de son gestionnaire ; un message en échec réapparaît après son délai de visibilité ; après maxReceiveCount réceptions, la politique de redrive le déplace vers une file de rejet](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/other-brokers-sqs-and-sns.fr.svg)

| Concept ici | SQS / SNS |
|---|---|
| *exchange* | un seul *topic* SNS pour tous les événements, ou un par contexte producteur |
| clé de routage | l'attribut de message `type`, comparé par la politique de filtre de chaque abonnement |
| confirmation de publication | la réponse de `Publish` / `PublishBatch`, vérifiée entrée par entrée |
| file d'attente par consommateur | une file SQS `<consumer>-<type>`, chaque point du type remplacé par `_` (`billing-ordering_order_placed`), abonnée au *topic* avec un filtre sur `type` |
| accusé de réception manuel | `DeleteMessage` après la résolution du gestionnaire |
| file de nouvelle tentative | aucune : le message réapparaît après son délai de visibilité |
| file morte | une seconde file SQS, cible de la politique de *redrive* (`maxReceiveCount`) |
| `x-attempt` | l'attribut `ApproximateReceiveCount` |
| identifiant de déduplication | aucun sur les files standard ; sur les *topics* et files FIFO, le `MessageDeduplicationId`, réglé sur l'identifiant de l'événement, sur cinq minutes |

Comment cela se transpose :

- `publish` : des lots de dix entrées ; un appel groupé (`PublishBatch`) réussit même si
  certaines entrées échouent, lisez donc la liste des échecs et rejetez si elle n'est pas vide. Identifiant
  d'entrée = identifiant de l'événement.
- `subscribe` : déduire le nom de la file du consommateur et du type, en remplaçant chaque
  point du type (un nom de file SQS n'accepte que lettres, chiffres, `-` et `_`, plus un
  `.fifo` final, jusqu'à 80 caractères), puis interroger la file en *long polling*, répartir,
  supprimer en cas de succès. En
  cas d'échec, régler le délai de visibilité de ce message sur le délai de nouvelle tentative
  (c'est la nouvelle tentative différée, et elle peut croître avec le nombre de réceptions) et
  le laisser.
- Abonnez la file avec la livraison de messages bruts, ou déballez l'enveloppe SNS : sinon le
  corps n'est pas l'événement et les attributs sont à l'intérieur.
- Message empoisonné : supprimez-le après l'avoir envoyé explicitement à la file de rejet, ou
  laissez la politique de *redrive* l'y porter après `maxReceiveCount` réceptions ; la première
  façon garde la raison.
- `settle` : aucun message visible, invisible ni différé dans la file, lu plusieurs fois de
  suite : les compteurs sont approximatifs.

Pièges :

- Un délai de visibilité inférieur au pire cas du gestionnaire livre le message une seconde fois
  alors que la première exécution tourne encore. Réglez-le bien au-dessus, et prolongez-le par
  un battement de cœur pour les gestionnaires longs.
- 256 Kio par message, attributs compris, et dix attributs au plus avec la livraison brute : les
  gros contenus demandent un *claim check*, que l'enveloppe ne fournit pas.
- Les files standard ne sont pas ordonnées et livrent des doublons en fonctionnement normal. Les
  *topics* et files FIFO ordonnent par groupe de messages (le `keyOf`) et ne dédupliquent que sur
  cinq minutes, à un débit plus faible.
- La politique de la file doit autoriser le *topic* à y envoyer ; sans elle, l'abonnement existe
  et rien n'arrive, en silence. `onUnroutable: 'fail'` n'a pas d'équivalent : SNS ne signale pas
  un événement qui ne correspond à aucun abonnement.
- Un changement de politique de filtre met des minutes à s'appliquer : un test qui s'abonne puis
  publie aussitôt est instable, sauf s'il attend la première livraison d'une sonde.
- Un consommateur créé après une publication ne la voit jamais : il n'y a pas de rejeu. Créez
  les files et les abonnements au déploiement, avant les producteurs.
- Les émulateurs locaux diffèrent du service sur les politiques de filtre et le moment du
  *redrive* : lancez la suite de contrat contre le vrai service au moins une fois.
