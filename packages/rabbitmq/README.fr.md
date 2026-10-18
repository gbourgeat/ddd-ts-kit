[English](README.md) · **Français**
<!-- translation-of: README.md sha256:dfa21eec942a560e -->

# @ddd-ts-kit/rabbitmq

Le fournisseur d'événements d'intégration pour RabbitMQ : un `EventBus` du noyau qui publie avec
des confirmations de publication (publisher confirms), pour que le relais de l'outbox puisse
marquer un enregistrement publié sans risque, et qui consomme depuis une file d'attente durable
par consommateur et par type d'événement, avec acquittement manuel, un nombre borné de nouvelles
tentatives différées et une file de rejet (dead letter). C'est la ligne « brokers à files
d'attente » du tableau des stratégies de `@ddd-ts-kit/events`, implémentée, et il passe
`eventBusContract` de `@ddd-ts-kit/testing`.

```
npm i @ddd-ts-kit/rabbitmq @ddd-ts-kit/events amqplib
```

Testé avec amqplib 2.2 contre RabbitMQ 4.3. Tout *broker* AMQP 0-9-1 doté de confirmations de
publication devrait fonctionner avec `queueType: 'classic'` ; seul RabbitMQ a été exécuté.

## Racine de composition

Les gestionnaires ne voient jamais ce *package*. Ils publient dans l'outbox ; le relais publie
dans RabbitMQ ; chaque contexte consommateur écoute par le bus, sous son propre nom. Le bus est
donné à l'application sous la forme de deux ports du noyau : `IntegrationEventPublisher` reste
l'outbox, et `EventSubscribers` remet à chaque contexte l'abonné de son propre nom de
consommateur.

![Le gestionnaire de ordering écrit la commande client et un enregistrement d'outbox dans une seule transaction ; le relais de l'outbox donne l'enregistrement à RabbitMqEventBus, qui le publie sur l'exchange topic integration-events avec le type d'événement comme clé de routage et attend la confirmation du broker ; l'exchange route une copie vers la file de travail de chaque consommateur lié pour ce type, billing.ordering.order.placed et shipping.ordering.order.placed ; chaque file la remet aux gestionnaires de son contexte, acquittée après la validation de leur unité de travail](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/rabbitmq-outbox-to-queues.fr.svg)

`init --broker rabbitmq` écrit ce câblage dans la plateforme du projet : le bus est construit par
`platform/events/create-event-provider.ts`, `platform/platform.module.ts` lie à nouveau
(`rebind`) `EventSubscribers` sur lui, et `main.ts` le donne, tracé, au relais de l'outbox. À la
main, la même chose s'écrit :

<!-- checked sample -->
```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { EventSubscribers, IntegrationEventPublisher, type Logger, type Metrics } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

declare const config: { readonly amqpUrl: string };
declare const logger: Logger;
declare const metrics: Metrics;

export const bus = new RabbitMqEventBus({
  connection: config.amqpUrl, // ou des options amqplib, ou une fabrique qui ouvre une nouvelle connexion
  exchange: 'integration-events', // la valeur par défaut
  retry: { maxAttempts: 5, delayMs: 5_000 }, // les valeurs par défaut
  prefetch: 10, // la valeur par défaut
  onFailure: (failure) => logger.warn('event bus failure', { ...failure }), // des codes seulement, jamais un message d'erreur
  // Le libellé `outcome` du noyau vaut success ou failure : les quatre issues d'une livraison prennent un autre nom.
  onDelivery: ({ queue, outcome }) => metrics.counter('event_deliveries_total').increment({ queue, status: outcome }),
});

export const messagingModule = defineContextModule({
  name: 'messaging',
  register(builder) {
    // Côté publication : les gestionnaires écrivent dans l'outbox, dans la transaction de la commande.
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
    // Côté consommation : un abonné par contexte consommateur, nommé d'après lui.
    builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
  },
});
```

<!-- checked sample -->
```ts
import { Command, CommandBus, systemActor, type Actor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// contexts/ordering/published-language : le contrat qu'écoute billing.
export const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: zodSchema(z.object({ orderId: z.string() })),
});

// contexts/billing/application/commands/issue-invoice/issue-invoice.command.ts
export class IssueInvoice extends Command {
  constructor(
    readonly actor: Actor,
    readonly orderId: string,
  ) {
    super();
  }
}

// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlacedIntegrationHandler {
  constructor(private readonly commands: CommandBus) {}

  // Personne n'appelle : le gestionnaire agit comme un acteur système nommé d'après son consommateur.
  readonly actor = systemActor('billing.invoice-on-order-placed');

  async handle(event: IntegrationEvent<PayloadOf<typeof orderPlaced>>): Promise<void> {
    await this.commands.execute(new IssueInvoice(this.actor, event.payload.orderId));
  }
}
```

<!-- checked sample -->
```ts
// main.ts
import { contextModule, createApplication, kernelModule, type ContextModule, type DeclaredSource } from '@ddd-ts-kit/di';
import { Clock } from '@ddd-ts-kit/kernel';
import { OutboxRelay, OutboxStore } from '@ddd-ts-kit/events';
import type { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

// Dans un projet : import { bus, messagingModule } from '@/platform/messaging.module';
declare const bus: RabbitMqEventBus;
declare const messagingModule: ContextModule;
declare const persistenceModule: ContextModule;
declare const orderingDeclarations: DeclaredSource;
declare const billingDeclarations: DeclaredSource;

const app = createApplication({
  modules: [
    kernelModule(),
    persistenceModule,
    messagingModule,
    contextModule('ordering', orderingDeclarations),
    contextModule('billing', billingDeclarations),
  ],
});

// La cible du relais est le bus. Un enregistrement est marqué publié quand le broker l'a confirmé.
const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: bus, clock: app.resolve(Clock) });

await app.start(); // abonne le gestionnaire de billing sur bus.forConsumer('billing')
await bus.assertTopology(); // échouer au démarrage, pas au premier message
relay.start({ intervalMs: 500 });

process.on('SIGTERM', async () => {
  await relay.stop(); // le tour en cours se termine
  await app.stop(); // les gestionnaires sont désabonnés
  await bus.close(); // les consommateurs s'arrêtent, les gestionnaires en cours se terminent et acquittent
});
```

- `persistenceModule` lie `OutboxStore`, et lie à nouveau `UnitOfWork` et `ProcessedEventStore`
  à la base de données : voir le README de l'adaptateur de persistance. Un gestionnaire d'événement
  d'intégration déclaré est abonné sur l'abonné de son propre contexte (`forContext` reçoit le
  nom de son module), et puisque `UnitOfWork` et `ProcessedEventStore` sont liés, sa marque
  d'idempotence et son travail sont validés dans une seule unité de travail : une relivraison est
  dédupliquée, un échec ne laisse rien derrière lui.
- Sans outbox, le bus est le bus d'événements du module du noyau, et les gestionnaires publient
  directement dans le *broker* :
  `kernelModule({ eventBus: bus, eventSubscribers: () => ({ forContext: (name) => bus.forConsumer(name) }) })`.
- Sans conteneur, les mêmes objets se câblent à la main : `bus.forConsumer('billing')` est un
  `IntegrationEventSubscriber`, à donner à `subscribeAll` et à `consume` de `@ddd-ts-kit/events`.
  Un bus construit sans l'option `consumer` n'a pas de nom à donner à ses files, si bien que
  `bus.subscribe(...)` lève `ConsumerNameRequiredError` : nommez plutôt le contexte consommateur.

<!-- checked sample -->
```ts
import { consume, defineIntegrationEvent, subscribeAll } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

declare const processed: ProcessedEventStore; // le store de l'adaptateur de persistance
declare const unitOfWork: UnitOfWork; // la transaction de la base de données
declare function issueInvoice(orderId: string): Promise<void>;

const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: zodSchema(z.object({ orderId: z.string() })),
});

const bus = new RabbitMqEventBus({ connection: 'amqp://kit:kit@127.0.0.1:5672' });

// Au lieu de : bus.subscribe(orderPlaced.type, handler), qui lève ici ConsumerNameRequiredError.
// Écrivez : l'abonné d'un contexte consommateur, dont les files portent le nom.
export const billing = subscribeAll(bus.forConsumer('billing'), [
  consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork }, async (event) => {
    await issueInvoice(event.payload.orderId);
  }),
]);

await bus.assertTopology(); // déclare billing.ordering.order.placed ainsi que ses .retry et .dead, puis consomme
```

- `publish(events)` ne se résout que lorsque le *broker* a confirmé **chaque** message du lot, et
  rejette sinon (`PUBLISH_NOT_CONFIRMED`, `BROKER_UNAVAILABLE`, `UNROUTABLE_EVENT`,
  `EVENT_BUS_CLOSED`). Rien n'est mis en mémoire pour plus tard : l'outbox est la mémoire tampon.
- Un nom de consommateur est requis pour s'abonner : `bus.forConsumer('billing')` donne un
  `IntegrationEventSubscriber` pour un contexte sur la connexion partagée (un monolithe modulaire
  en a plusieurs), et l'option `consumer` nomme celui pour lequel travaille `bus.subscribe` (un
  service qui est un seul contexte).
- Le traçage est posé autour des deux côtés depuis l'extérieur, comme avec tout fournisseur :
  `tracedPublisher(bus)` comme cible du relais, et côté consommation l'instrumentation du module
  du noyau (`kernelModule({ instrumentation: traceApplication() })`), qui donne à chaque
  gestionnaire déclaré un *span* `process <consumer>` par tentative.
  `tracedSubscriber(bus.forConsumer(name))` sert à une composition sans `kernelModule`. Le bus
  transporte `traceparent` et `correlationId` intacts, dans l'enveloppe et dans les en-têtes du
  message.
- La corrélation fait l'aller-retour. Publiez par `scopedPublisher(publisher, scope)` du noyau :
  un gestionnaire déclaré (ou `consume(definition, { ..., scope }, handler)` à la main)
  s'exécute dans un contexte d'exécution dont le `correlationId` est celui de l'appel qui a
  publié, dont le `causationId` est l'événement, et une relivraison après un échec s'exécute
  dans le même. Un opérateur le lit sur le message sans en ouvrir le corps, dans la propriété
  `correlation_id` et l'en-tête `x-correlation-id`.
- Un contexte extrait dans son propre service garde son nom de consommateur et donc ses files :
  rien ne change sur le *broker*.

## Topologie

`bus.describeTopology()` renvoie les *exchanges*, les files et les liaisons sous forme de données,
pour une revue ou un document généré ; `bus.assertTopology()` les déclare, de façon idempotente.
Le bus les déclare aussi à chaque (re)connexion. Pour `forConsumer('billing')` abonné à
`ordering.order.placed` :

| Objet | Nom | Propriétés |
|---|---|---|
| *exchange* | `integration-events` | topic, durable |
| file de travail | `billing.ordering.order.placed` | durable, quorum ; liée à l'*exchange* avec la clé de routage `ordering.order.placed` ; renvoie ses rejets (dead letters) vers la file de rejet |
| file de nouvelles tentatives | `billing.ordering.order.placed.retry` | durable, quorum ; `x-message-ttl` = `retry.delayMs` ; renvoie ses rejets vers la file de travail, au moins une fois |
| file de rejet | `billing.ordering.order.placed.dead` | durable, quorum ; aucun consommateur |

Les nouvelles tentatives et les rejets passent par l'*exchange* par défaut du *broker* (clé de
routage = nom de la file) : il n'y a donc qu'un *exchange* à gérer, et aucune liaison en dehors
de celle ci-dessus. Une file de nouvelles tentatives quorum prend aussi
`x-dead-letter-strategy: at-least-once` et `x-overflow: reject-publish`, pour qu'une nouvelle
tentative expirée ne se perde pas sur le chemin du retour vers la file de travail.

Un message est l'enveloppe en JSON (`id`, `type`, `version`, `occurredAt`, `payload`,
`traceparent`, `correlationId`, `tenantId`), persistant, avec la clé de routage et la propriété
`type` réglées sur le type d'événement, `messageId` sur l'identifiant de l'événement,
`correlationId` sur l'identifiant de corrélation, et les en-têtes `traceparent`,
`x-correlation-id`, `x-tenant-id` et `x-event-version`. N'importe quel client AMQP peut le
consommer.

Deux consommateurs d'un même type ont chacun une file et reçoivent tous deux chaque événement.
Deux instances d'un même consommateur partagent sa file : chaque événement va à l'une d'elles.

## Comportement des nouvelles tentatives et de la file de rejet

![Les trois files du consommateur billing pour le type ordering.order.placed : la file de travail remet un message aux gestionnaires avec sa tentative n lue dans x-attempt ; quand un gestionnaire a levé une exception et que n est inférieur à retry.maxAttempts, le bus envoie une copie confirmée à la file de nouvelles tentatives avec x-attempt n plus 1, puis acquitte l'original ; la copie attend retry.delayMs, la durée de vie de la file de nouvelles tentatives, et le broker la renvoie en dead-letter vers la file de travail ; à n égal à retry.maxAttempts, et aussitôt pour un message empoisonné, la copie va à la place dans la file de rejet ; un consommateur qui plante sans cesse voit le broker lui-même envoyer le message dans la file de rejet, par la limite de livraisons d'une file quorum](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/rabbitmq-retry-and-dead-letter.fr.svg)

1. Un message est acquitté après que chaque gestionnaire abonné à sa file s'est résolu. Un
   `@IntegrationEventHandler` déclaré (ou `consume` de `@ddd-ts-kit/events` à la main) valide son
   travail et sa marque d'idempotence dans une seule unité de travail : l'acquittement suit alors
   cette validation, et une relivraison est dédupliquée.
2. Quand un gestionnaire lève une exception, le bus envoie une copie confirmée du message à la
   file de nouvelles tentatives, avec l'en-tête `x-attempt` incrémenté et `x-error-code`
   renseigné, puis acquitte l'original. La copie y attend `retry.delayMs` et revient dans la file
   de travail. Un message en échec n'est jamais remis en file sur-le-champ : pas de boucle folle.
3. À la `retry.maxAttempts`-ième livraison en échec, la copie va à la place dans la file de
   rejet, avec `x-dead-reason: max-attempts`.
4. Un message dont le corps n'est pas une enveloppe (illisible, sans `id`, `type`, `version` ou
   `occurredAt`, ou avec un `tenantId` que `isTenantId` du noyau refuse) est empoisonné (poison) :
   il va directement dans la file de rejet avec `x-dead-reason: poison` et
   `x-error-code: POISON_MESSAGE`, et aucun gestionnaire ne le voit.
5. Seuls des codes voyagent : `x-error-code` est le `code` de l'erreur ou le nom de sa classe. Le
   message d'une erreur n'est jamais journalisé, remonté ni joint, car il peut citer des données
   du *payload*.

La livraison est au moins une fois et sans ordre. L'ordre « copier puis acquitter » signifie
qu'un plantage entre les deux livre le message deux fois, jamais zéro fois.

Sur une connexion perdue, le bus se reconnecte avec un recul exponentiel (`reconnect`, 200 ms
doublés jusqu'à 30 s), déclare à nouveau sa topologie et reprend ses consommateurs. Les
publications en cours rejettent, tout comme `publish` entre deux tentatives, si bien que le
relais de l'outbox garde les enregistrements et les retente. Les messages qui étaient en cours de
traitement sont relivrés par le *broker*.

**Secrets de connexion.** L'URL ou les options de `connection` sont détenues par la fonction qui ouvre la connexion, dans aucun champ. Un `RabbitMqEventBus` journalisé, étalé ou
sérialisé montre `RabbitMqEventBus [connection concealed]` et rien d'autre : ses champs ne sont pas énumérables,
et `toJSON` et `util.inspect` répondent ce nom. Les échecs qu'il signale sont des codes. Ce que la
bibliothèque cliente montre elle-même quand l'un de ses propres objets est inspecté n'est pas
entre les mains de ce *package* : ne journalisez pas ces objets.

**Ce qu'on dit à un gestionnaire.** À côté de l'événement, chaque gestionnaire reçoit la
livraison (`EventDelivery` du noyau) : `{ attempt, maxAttempts, system: 'rabbitmq', destination, consumer }`,
où `destination` est la file de travail et `consumer` le nom du consommateur (`billing`). Les gestionnaires de l'application l'ignorent ; `@ddd-ts-kit/tracing` la lit
pour faire un *span* CONSUMER par tentative et pour marquer les relivraisons et la tentative après
laquelle l'événement est enterré. Le bus se nomme `messagingSystem: 'rabbitmq'`, et `traceparent` voyage dans
l'enveloppe et comme véritable en-tête, intact d'une nouvelle tentative à l'autre.

## Exploitation

Ce qu'il faut surveiller :

| Signal | Où | Signification |
|---|---|---|
| `stats()` de l'outbox (`pending`, `failed`, `dead`) | le store de l'outbox | le côté publication : voir `@ddd-ts-kit/events` |
| profondeur de `<consumer>.<type>` | *broker* | le consommateur prend du retard ou est arrêté |
| profondeur de `<consumer>.<type>.dead` | *broker* | doit être 0 : alertez sur toute autre valeur |
| profondeur de `<consumer>.<type>.retry` | *broker* | des échecs en cours ; un plateau signale un gestionnaire qui échoue sans cesse |
| `onDelivery` compté par `outcome` | ce bus | le taux de `retried`, `dead`, `poison` rapporté à `acknowledged` |
| `onFailure` avec `kind: 'connection'` | ce bus | les reconnexions, et les déclarations que le *broker* a refusées (`AMQP_406`) |
| `bus.deliveriesInFlight` | ce bus | les gestionnaires en cours d'exécution ; bloqué au-dessus de 0, c'est un gestionnaire qui ne rend pas la main |

Avec un outil de suivi des erreurs, `DeadLetterReports` du noyau transforme `onFailure` en
rapports des événements abandonnés, et de ceux-là seulement :
`onFailure: (failure) => reports.onFailure(failure)`, et `reports.observing(bus.forConsumer(name))`
comme abonné de chaque contexte, pour qu'un rapport porte ce que le gestionnaire a levé. `init`
le câble quand le projet en a un.

Rejouer les messages rejetés, une fois la cause corrigée :

<!-- checked sample -->
```ts
import type { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

declare const bus: RabbitMqEventBus;

// Jusqu'à 100 messages de billing.ordering.order.placed.dead, renvoyés dans la file de travail avec x-attempt 1.
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
console.log(`${String(replayed)} message(s) replayed`);
```

Il déplace jusqu'à ce nombre de messages de la file de rejet vers la file de travail avec un
budget de tentatives neuf, chacun avec une copie confirmée avant l'acquittement. L'interface de
gestion ou une *shovel* peuvent aussi les déplacer ; dans ce cas, remettez à zéro ou supprimez
l'en-tête `x-attempt`, sinon le message meurt à nouveau à son premier échec. Regardez d'abord
`x-dead-reason` et `x-error-code` : rejouer un message empoisonné ne fait que le tuer à nouveau.

Pour arrêter un consommateur pour de bon, supprimez ses trois files : le désabonnement les laisse
liées, et la file de travail continue de se remplir.

## Limites

- **Pas d'ordre.** Les nouvelles tentatives et les instances concurrentes réordonnent. Portez une
  version dans le *payload*.
- **Un seul délai.** L'attente avant une nouvelle tentative est le TTL de la file de nouvelles
  tentatives : le même pour chaque tentative, sans recul exponentiel.
- **Les arguments d'une file sont fixés à sa création.** Changer `retry.delayMs` ou `queueType`
  pour une file existante est refusé par le *broker* (signalé comme `AMQP_406` pendant que le bus
  continue d'essayer de se reconnecter) : supprimez la file, ou migrez sous un autre nom de
  consommateur.
- **Une relivraison exécute à nouveau chaque gestionnaire de la file**, y compris ceux qui ont
  réussi, quand plusieurs gestionnaires d'un même consommateur s'abonnent au même type. Chacun
  doit être idempotent.
- **Un lot n'est pas atomique.** Quand `publish` rejette, certains événements du lot ont pu être
  pris par le *broker*. Le relais publie un par un et retente, les consommateurs dédupliquent.
- **`onUnroutable: 'fail'`** rejette un événement pour lequel aucune file n'est liée ; derrière le
  relais de l'outbox, un tel enregistrement est retenté, puis passe à l'état mort (*dead*). Ne
  l'utilisez que lorsqu'un consommateur manquant est un incident.
- **Un consommateur qui plante en plein gestionnaire** récupère ses messages sans que `x-attempt`
  soit incrémenté. Les files quorum bornent cela par leur limite de livraisons, au-delà de
  laquelle le *broker* envoie le message dans la file de rejet ; les files classiques ne le
  bornent pas. Ce chemin appartient au *broker* et n'est pas exercé par la suite de tests.
- **Les files classiques** renvoient les nouvelles tentatives expirées au plus une fois : un
  plantage du *broker* à cet instant peut en perdre une. Les files quorum (le défaut) utilisent la
  stratégie au moins une fois.
- **Une fabrique de connexion doit ouvrir une nouvelle connexion à chaque appel** ; le bus ferme
  ce qu'il a ouvert. Une connexion partagée avec d'autre code ne peut pas être donnée.
- Les gros lots sont écrits sans attendre que le *socket* se vide : la mémoire grossit avec le
  lot. Le relais publie enregistrement par enregistrement, ce qui l'évite.
- Les noms de files sont `<consumer>.<type>` plus un suffixe, dans les 255 octets d'AMQP.

## Autres brokers

[`@ddd-ts-kit/kafka`](../kafka/README.fr.md), [`@ddd-ts-kit/nats`](../nats/README.fr.md) et
[`@ddd-ts-kit/redis`](../redis/README.fr.md) (Redis Streams) implémentent les deux mêmes ports et
passent la même suite de contrat. [docs/other-brokers.md](docs/other-brokers.fr.md) dit ce que
chaque fournisseur doit, fait correspondre les concepts de celui-ci à Kafka et à JetStream comme
ces *packages* le font, et esquisse SQS/SNS, qui n'est pas construit.

## Tests

Le codec de l'enveloppe, les réglages et leurs valeurs par défaut, la description de la
topologie et les codes d'échec sont couverts sans *broker*, par les tests unitaires. Les autres
suites ont besoin d'un vrai *broker* et sont ignorées sans `DDD_TS_KIT_TEST_AMQP_URL` :

```
docker run -d --rm --name ddd-ts-kit-test-rabbitmq -e RABBITMQ_DEFAULT_USER=kit -e RABBITMQ_DEFAULT_PASS=kit -p 127.0.0.1:5672:5672 rabbitmq:4-management-alpine
DDD_TS_KIT_TEST_AMQP_URL=amqp://kit:kit@127.0.0.1:5672 npx vitest run packages/rabbitmq
docker rm -f ddd-ts-kit-test-rabbitmq
```

Elles exécutent la suite de contrat sur des files quorum et sur des files classiques, puis les
comportements de ce fournisseur, une suite par comportement (`publishing`, `consuming`,
`correlation`, `retries`, `dead-letters`, `topology`, `connection-loss` à travers un relais TCP
que le test coupe, `closing`), et toute la chaîne de l'outbox jusqu'à un consommateur idempotent.
Chaque test travaille sur un *exchange* et des files qui lui sont propres, et les supprime.
