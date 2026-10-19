[English](README.md) · **Français**
<!-- translation-of: README.md sha256:bfde6b4ebfa4d955 -->

# @ddd-ts-kit/nats

Le fournisseur d'événements d'intégration pour NATS JetStream : un `EventBus` du noyau qui publie
dans un flux (stream) et attend son acquittement, avec l'identifiant de l'événement comme
identifiant de message pour que le flux écarte une nouvelle tentative du relais, et qui consomme
depuis un consommateur durable en mode *pull* par consommateur et par type d'événement, avec
acquittement explicite, un nombre borné de relivraisons différées et un flux de rejet (dead
letter). C'est l'équivalent JetStream de la ligne « brokers à files d'attente » du tableau des
stratégies de `docs/ARCHITECTURE.md`, et il passe `eventBusContract` de `@ddd-ts-kit/testing`.

```
npm i @ddd-ts-kit/nats @ddd-ts-kit/events @nats-io/transport-node @nats-io/jetstream
```

Testé avec `@nats-io/transport-node` et `@nats-io/jetstream` 3.4 contre NATS Server 2.15
démarré avec `-js`, sur Node 24. NATS de base (core) n'a pas de persistance : seul JetStream
convient aux ports.

## Le client

Le client modulaire du projet NATS : `@nats-io/transport-node` pour la connexion,
`@nats-io/jetstream` pour les flux et les consommateurs. Les deux sont en 3.4.0 (publiée le
2026-05-13), en JavaScript pur, 1,7 Mo une fois installés avec leurs trois dépendances, sans
script d'installation, et téléchargés environ 400 000 et 300 000 fois par semaine. L'ancien
*package* `nats` (2.29) reçoit encore des correctifs, mais c'est la génération précédente du
client ; rien ne l'a rendu nécessaire.

## Racine de composition

Les gestionnaires ne voient jamais ce *package*. Ils publient dans l'outbox ; le relais publie
dans NATS ; chaque contexte consommateur écoute par le bus, sous son propre nom. Le bus est donné
à l'application sous la forme de deux ports du noyau : `IntegrationEventPublisher` reste
l'outbox, et `EventSubscribers` remet à chaque contexte l'abonné de son propre nom de
consommateur.

![Le gestionnaire de ordering écrit la commande client et un enregistrement d'outbox dans une seule transaction ; le relais de l'outbox donne l'enregistrement à NatsEventBus, qui le publie dans le flux integration-events avec l'identifiant de l'événement comme Nats-Msg-Id et attend l'acquittement ; le flux écarte un second message de même identifiant dans sa fenêtre de déduplication ; un consommateur durable par consommateur et par type d'événement tire le message et le remet aux gestionnaires de son contexte, acquitté après la validation de leur unité de travail ; ce qu'un consommateur abandonne est copié dans le flux integration-events-dead](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/nats-outbox-to-consumers.fr.svg)

`init --broker nats` écrit ce câblage dans la plateforme du projet : le bus est construit par
`platform/events/create-event-provider.ts`, `platform/platform.module.ts` lie à nouveau
(`rebind`) `EventSubscribers` sur lui, et `main.ts` le donne, tracé, au relais de l'outbox. À la
main, la même chose s'écrit :

<!-- checked sample -->
```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { EventSubscribers, IntegrationEventPublisher, type Logger, type Metrics } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import { NatsEventBus } from '@ddd-ts-kit/nats';

declare const config: { readonly natsUrl: string };
declare const logger: Logger;
declare const metrics: Metrics;

export const bus = new NatsEventBus({
  connection: config.natsUrl, // ou une liste, ou des options du client, ou une fabrique qui ouvre une nouvelle connexion
  stream: 'integration-events', // la valeur par défaut
  subjectPrefix: 'events', // la valeur par défaut : les événements vont dans events.<type d'événement>
  replicas: 3, // 1 par défaut
  retry: { maxAttempts: 5, delayMs: 5_000 }, // les valeurs par défaut
  prefetch: 10, // la valeur par défaut
  onFailure: (failure) => logger.warn('event bus failure', { ...failure }), // des codes seulement, jamais un message d'erreur
  // Le libellé `outcome` du noyau vaut success ou failure : les quatre issues d'une livraison prennent un autre nom.
  onDelivery: ({ consumer, outcome }) => metrics.counter('event_deliveries_total').increment({ consumer, status: outcome }),
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
import type { NatsEventBus } from '@ddd-ts-kit/nats';

// Dans un projet : import { bus, messagingModule } from '@/platform/messaging.module';
declare const bus: NatsEventBus;
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

// La cible du relais est le bus. Un enregistrement est marqué publié quand le flux l'a acquitté.
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
  Un bus construit sans l'option `consumer` n'a pas de nom à donner à ses consommateurs durables,
  si bien que `bus.subscribe(...)` lève `ConsumerNameRequiredError` : nommez plutôt le contexte
  consommateur.

<!-- checked sample -->
```ts
import { consume, defineIntegrationEvent, subscribeAll } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { NatsEventBus } from '@ddd-ts-kit/nats';
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

const bus = new NatsEventBus({ connection: 'nats://127.0.0.1:4222' });

// Au lieu de : bus.subscribe(orderPlaced.type, handler), qui lève ici ConsumerNameRequiredError.
// Écrivez : l'abonné d'un contexte consommateur, dont les consommateurs durables portent le nom.
export const billing = subscribeAll(bus.forConsumer('billing'), [
  consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork }, async (event) => {
    await issueInvoice(event.payload.orderId);
  }),
]);

await bus.assertTopology(); // crée billing_ordering_order_placed, puis consomme
```

- `publish(events)` ne se résout que lorsque le flux a acquitté **chaque** message du lot comme
  stocké, et rejette sinon (`PUBLISH_NOT_ACKNOWLEDGED`, `BROKER_UNAVAILABLE`,
  `EVENT_BUS_CLOSED`). Rien n'est mis en mémoire pour plus tard : l'outbox est la mémoire tampon.
- Chaque message porte l'en-tête `Nats-Msg-Id` = l'identifiant de l'événement. Le flux écarte un
  second message de même identifiant dans sa fenêtre de déduplication (`duplicateWindowMs`,
  **deux minutes** par défaut, fixée à la création du flux) et l'acquitte quand même : un relais
  qui retente une publication dont l'acquittement s'est perdu ne crée pas de second message. La
  fenêtre couvre une nouvelle tentative, pas un rejeu des heures plus tard : les consommateurs
  dédupliquent toujours.
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
  un gestionnaire déclaré (ou `consume(definition, { ..., scope }, handler)` à la main, ou un
  *callback* enveloppé avec `inEventScope`) s'exécute dans un contexte d'exécution dont le
  `correlationId` est celui de l'appel qui a publié, dont le `causationId` est l'événement, et
  une relivraison s'exécute dans le même.
- Un contexte extrait dans son propre service garde son nom de consommateur et donc ses
  consommateurs durables : rien ne change sur le serveur.

## Topologie

`bus.describeTopology()` renvoie les flux et les consommateurs durables sous forme de données,
pour une revue ou un document généré ; `bus.assertTopology()` les crée, de façon idempotente. Le
bus les crée aussi à chaque nouvelle connexion. Pour `forConsumer('billing')` abonné à
`ordering.order.placed` :

| Objet | Nom | Propriétés |
|---|---|---|
| flux d'événements | `integration-events` | sujets `events.>`, rétention `limits`, stockage fichier, `replicas`, fenêtre de déduplication 2 min |
| sujet | `events.ordering.order.placed` | `<subjectPrefix>.<event type>` : le type occupe plusieurs jetons du sujet, pris en entier par le filtre |
| consommateur durable | `billing_ordering_order_placed` | *pull*, filtre sur le sujet ci-dessus, acquittement explicite, *deliver all*, `ack_wait` = `ackWaitMs` (30 s), `max_deliver` = 2 x `retry.maxAttempts` |
| flux de rejet | `integration-events-dead` | sujets `dead.events.>`, même stockage et mêmes répliques |
| sujet de rejet | `dead.events.billing.ordering.order.placed` | `dead.<subjectPrefix>.<consumer>.<event type>` : un par consommateur et par type |

Un nom de consommateur durable ne contient ni point ni joker : chaque caractère du nom de
consommateur et du type hors de `[A-Za-z0-9_-]` devient `_`.

Un message est l'enveloppe en JSON (`id`, `type`, `version`, `occurredAt`, `payload`,
`traceparent`, `correlationId`, `tenantId`) avec les en-têtes `Nats-Msg-Id` (l'identifiant de
l'événement), `x-event-type`, `x-event-version`, `traceparent`, `x-correlation-id` et
`x-tenant-id`. N'importe quel client NATS peut le consommer.

Deux consommateurs d'un même type ont chacun un consommateur durable et reçoivent tous deux
chaque événement. Deux instances d'un même consommateur tirent depuis le même consommateur
durable : chaque événement va à l'une d'elles.

Un flux existant n'est jamais modifié : le bus accepte un flux du même nom quelles que soient ses
limites, si bien que la rétention, l'âge maximal et la taille sont à vous de les régler dessus.
Un consommateur durable existant prend l'`ack_wait` et le `max_deliver` du bus qui le déclare.

## Ordre

Aucun. Le flux garde l'ordre de publication, mais un consommateur traite `prefetch` messages à
la fois, les instances concurrentes s'entrelacent, et une relivraison revient après les messages
qui ont suivi. Portez une version dans le *payload*, ou utilisez le fournisseur Kafka quand
l'ordre d'un agrégat compte.

## Comportement des nouvelles tentatives et du flux de rejet

![Ce que devient un message livré à un consommateur durable : un message rejoué pour un autre consommateur est acquitté et ignoré ; un corps qui n'est pas une enveloppe est copié dans le flux de rejet comme empoisonné, puis terminé ; sinon chaque gestionnaire du type s'exécute ; quand tous se sont résolus, le message est acquitté ; quand l'un a levé une exception avant la dernière tentative, le message est refusé avec un délai et le serveur le livre à nouveau, compteur de livraisons plus un ; à la tentative retry.maxAttempts, il est copié dans le flux de rejet avec max-attempts, puis terminé](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/nats-retry-and-dead-letter.fr.svg)

1. Un message est acquitté après que chaque gestionnaire abonné à son consommateur durable s'est
   résolu. Un `@IntegrationEventHandler` déclaré (ou `consume` de `@ddd-ts-kit/events` à la
   main) valide son travail et sa marque d'idempotence dans une seule unité de travail :
   l'acquittement suit alors cette validation, et une relivraison est dédupliquée.
2. Quand un gestionnaire lève une exception, le bus refuse le message avec un délai (`nak` avec
   `retry.delayMs`) : le serveur le livre à nouveau après ce délai, à n'importe quelle instance.
   Le numéro de tentative est le compteur de livraisons du serveur. Pas de boucle folle.
3. À la `retry.maxAttempts`-ième livraison en échec, le bus publie une copie sur le sujet de
   rejet, avec `x-dead-reason: max-attempts`, `x-error-code`, `x-attempt` et `x-source`
   (`<stream>/<sequence>`), attend l'acquittement du flux de rejet, puis termine l'original
   (`term`). Si la copie ne peut pas être stockée, le message est refusé avec le délai à la
   place, et mis de côté à une livraison ultérieure.
4. Un message dont le corps n'est pas une enveloppe (illisible, sans `id`, `type`, `version` ou
   `occurredAt`, ou avec un `tenantId` que `isTenantId` du noyau refuse) est empoisonné (poison) :
   il va directement dans le flux de rejet avec `x-dead-reason: poison` et
   `x-error-code: POISON_MESSAGE`, et aucun gestionnaire ne le voit.
5. Seuls des codes voyagent : `x-error-code` est le `code` de l'erreur ou le nom de sa classe. Le
   message d'une erreur n'est jamais journalisé, remonté ni joint, car il peut citer des données
   du *payload*.

**Pourquoi une copie explicite et pas l'*advisory*.** Quand un message atteint `max_deliver`, le
serveur cesse de le livrer et émet `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES`. Cet *advisory*
est un message de NATS de base : perdu si personne n'écoute à cet instant, il porte une séquence
de flux et aucun code d'échec, et le message lui-même reste dans le flux, où aucun consommateur
ne le lira plus. Le bus connaît le code d'échec et sait que c'est la dernière tentative : il met
donc lui-même le message de côté, par une publication acquittée.

**Pourquoi `max_deliver` vaut deux fois `maxAttempts`.** Le compteur de livraisons augmente aussi
quand une livraison se termine sans verdict : un processus tué en plein gestionnaire, une attente
d'acquittement expirée, une connexion coupée. Avec `max_deliver` égal à `maxAttempts`, une telle
livraison pourrait consommer la dernière, et le serveur retirerait alors le message du
consommateur en silence. Le bus met de côté à `maxAttempts` ; la limite du serveur est un
garde-fou au-dessus. Un message qui épuise même celle-ci reste dans le flux, non livré :
l'*advisory* ci-dessus est l'alerte à avoir.

La livraison est au moins une fois. L'ordre « copier puis terminer » signifie qu'un plantage
entre les deux livre à nouveau le message et le met à nouveau de côté : le flux de rejet en garde
une seule copie, parce que la copie a son propre identifiant de message
(`<durable>.<sequence>`).

Sur une connexion perdue, le client se reconnecte de lui-même et ses consommateurs *pull*
reprennent : les flux et les consommateurs durables vivent sur le serveur, rien n'est à déclarer
à nouveau. Tant que le serveur est absent, `publish` rejette aussitôt avec `BROKER_UNAVAILABLE`,
et une publication en cours rejette après `publishTimeoutMs` (5 s par défaut) avec
`PUBLISH_NOT_ACKNOWLEDGED`, si bien que le relais de l'outbox garde les enregistrements et les
retente. Les messages qui étaient en cours de traitement sont livrés à nouveau après
`ackWaitMs`. Le bus ouvre lui-même la première connexion, avec un recul exponentiel
(`reconnect`, 200 ms doublés jusqu'à 30 s), et en ouvre une nouvelle si le client abandonne un
jour.

**Secrets de connexion.** L'URL ou les options de `connection` sont détenues par la fonction qui ouvre la connexion, dans aucun champ. Un `NatsEventBus` journalisé, étalé ou
sérialisé montre `NatsEventBus [connection concealed]` et rien d'autre : ses champs ne sont pas énumérables,
et `toJSON` et `util.inspect` répondent ce nom. Les échecs qu'il signale sont des codes. Ce que la
bibliothèque cliente montre elle-même quand l'un de ses propres objets est inspecté n'est pas
entre les mains de ce *package* : ne journalisez pas ces objets.

**Ce qu'on dit à un gestionnaire.** À côté de l'événement, chaque gestionnaire reçoit la
livraison (`EventDelivery` du noyau) : `{ attempt, maxAttempts, system: 'nats', destination, consumer }`,
où `destination` est le sujet et `consumer` le consommateur durable
(`billing_ordering_order_placed`). Les gestionnaires de l'application l'ignorent ; `@ddd-ts-kit/tracing` la lit
pour faire un *span* CONSUMER par tentative et pour marquer les relivraisons et la tentative après
laquelle l'événement est enterré. Le bus se nomme `messagingSystem: 'nats'`, et `traceparent` voyage dans
l'enveloppe et comme véritable en-tête, intact d'une nouvelle tentative à l'autre.

## Exploitation

Ce qu'il faut surveiller :

| Signal | Où | Signification |
|---|---|---|
| `stats()` de l'outbox (`pending`, `failed`, `dead`) | le store de l'outbox | le côté publication : voir `@ddd-ts-kit/events` |
| `num_pending` de `<consumer>_<type>` | serveur (`nats consumer info`, l'exporteur) | le consommateur prend du retard ou est arrêté |
| `num_ack_pending` du même | serveur | traités en ce moment ou en attente d'une relivraison ; un plateau signale un gestionnaire qui échoue sans cesse |
| messages dans `<stream>-dead`, par sujet | serveur (`nats stream subjects <stream>-dead`) | la profondeur du flux de rejet : doit être 0, alertez sur toute autre valeur |
| `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.<stream>.>` | serveur | un message que le bus n'a pas pu mettre de côté avant que le serveur y renonce |
| `onDelivery` compté par `outcome` | ce bus | le taux de `retried`, `dead`, `poison` rapporté à `acknowledged` |
| `onFailure` avec `kind: 'connection'` | ce bus | les déconnexions (`CONNECTION_LOST`) et les requêtes que le serveur a refusées (`JETSTREAM_<code>`) |
| `bus.deliveriesInFlight` | ce bus | les gestionnaires en cours d'exécution ; bloqué au-dessus de 0, c'est un gestionnaire qui ne rend pas la main |

Avec un outil de suivi des erreurs, `DeadLetterReports` du noyau transforme `onFailure` en
rapports des événements abandonnés, et de ceux-là seulement :
`onFailure: (failure) => reports.onFailure(failure)`, et `reports.observing(bus.forConsumer(name))`
comme abonné de chaque contexte, pour qu'un rapport porte ce que le gestionnaire a levé. `init`
le câble quand le projet en a un.

Rejouer les messages rejetés, une fois la cause corrigée :

<!-- checked sample -->
```ts
import type { NatsEventBus } from '@ddd-ts-kit/nats';

declare const bus: NatsEventBus;

// Jusqu'à 100 messages auxquels billing a renoncé pour ce type, du plus ancien au plus récent.
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
console.log(`${String(replayed)} message(s) replayed`);
```

Il déplace jusqu'à ce nombre de messages de ce consommateur du flux de rejet vers le sujet d'où
ils viennent, du plus ancien au plus récent, chacun avec une copie acquittée avant d'être
supprimé du flux de rejet, et avec l'en-tête `x-replay-for` qui nomme le consommateur durable.
Les autres consommateurs de ce kit acquittent et ignorent un message marqué pour quelqu'un
d'autre ; un consommateur écrit sans ce kit voit l'événement une seconde fois et doit
dédupliquer. La copie est un nouveau message : son compteur de livraisons repart du début.
Regardez d'abord `x-dead-reason` et `x-error-code` : rejouer un message empoisonné ne fait que le
tuer à nouveau.

Pour arrêter un consommateur pour de bon, supprimez ses consommateurs durables : le désabonnement
les laisse en place, et un flux en rétention `interest` garderait leurs messages pour toujours.

## Limites

- **Pas d'ordre**, voir plus haut.
- **Un seul délai.** L'attente est la même pour chaque tentative. La liste `backoff` d'un
  consommateur JetStream n'est pas utilisée : elle s'applique aux attentes d'acquittement
  expirées, pas aux refus.
- **Un gestionnaire doit finir en moins de `ackWaitMs`** (30 s par défaut). Au-delà, le serveur
  livre le message à une autre instance pendant que la première tourne encore. Le bus n'envoie
  aucun signal de progression : relevez `ackWaitMs` au-dessus du pire cas des gestionnaires.
- **La fenêtre de déduplication est courte** et appartient au flux : deux minutes, sauf si le
  flux a été créé autrement, et un flux existant garde la sienne. Elle absorbe une nouvelle
  tentative du relais, pas un enregistrement ressuscité depuis l'état mort de l'outbox une heure
  plus tard.
- **La rétention est `limits`**, sans limites : le flux d'événements grossit tant que vous ne lui
  fixez pas d'âge ou de taille maximaux. Ne la passez pas en `workqueue` : deux consommateurs ne
  pourraient plus recevoir tous deux chaque événement. Avec `interest`, chaque consommateur
  durable doit exister avant la première publication qui le concerne.
- **Un consommateur créé après une publication la reçoit** (politique de livraison `all`, tant
  que le flux l'a conservée) : un nouveau contexte consommateur rejoue l'historique conservé de
  ses types.
- **Une relivraison exécute à nouveau chaque gestionnaire du consommateur durable**, y compris
  ceux qui ont réussi, quand plusieurs gestionnaires d'un même consommateur s'abonnent au même
  type. Chacun doit être idempotent.
- **Un lot n'est pas atomique.** Quand `publish` rejette, certains événements du lot ont pu être
  stockés. Le relais publie un par un et retente ; le flux déduplique, puis les consommateurs.
- **Un événement qu'aucun consommateur n'écoute est quand même stocké** : il n'existe pas
  d'équivalent de `onUnroutable`.
- **Deux noms qui ne diffèrent que par un caractère remplacé entrent en collision** : `billing.eu`
  et `billing_eu` sont le même consommateur durable.
- **`replayDead` lit directement le flux de rejet**, ce qui demande `allow_direct` sur celui-ci :
  le bus le règle sur le flux qu'il crée ; réglez-le vous-même sur un flux que vous avez créé.
- **Une fabrique de connexion doit ouvrir une nouvelle connexion à chaque appel** et devrait
  garder illimitée la reconnexion du client (`maxReconnectAttempts: -1`, ce que règle le bus
  quand on lui donne une URL) ; le bus ferme ce qu'il a ouvert.
- Fermer pendant que le serveur est absent n'attend pas l'envoi des acquittements en cours : ces
  messages sont livrés à nouveau.

Non vérifié par la suite de tests : une grappe de plusieurs serveurs (répliques au-delà de 1,
élection d'un leader, un flux qui perd son quorum), TLS et l'authentification, une attente
d'acquittement qui expire pendant un gestionnaire, un processus consommateur tué en plein
gestionnaire, le chemin `MAX_DELIVERIES` au-delà de la limite du bus, un consommateur durable ou
un flux supprimé pendant que le bus tourne (le bus rouvre alors sa connexion et redéclare tout ;
le chemin n'est pas exercé), la rétention `interest`, les serveurs antérieurs à 2.15, et le
transport WebSocket.

## Autres fournisseurs

`@ddd-ts-kit/rabbitmq` et `@ddd-ts-kit/kafka` implémentent les deux mêmes ports et passent la
même suite de contrat. Les trois partagent l'enveloppe, les noms des en-têtes (`traceparent`,
`x-correlation-id`, `x-event-version`, `x-attempt`, `x-error-code`, `x-dead-reason`), les noms
des options (`consumer`, `retry`, `reconnect`, `onFailure`, `onDelivery`) et les méthodes
(`forConsumer`, `assertTopology`, `describeTopology`, `replayDead`, `close`).

## Tests

Toutes les suites tournent dans les tests unitaires : le bus se connecte, par le vrai client et
son transport TCP, à un serveur NATS que le test démarre dans son propre processus, sur un port
libre (`test/support/server/`). Il parle le protocole de base et répond à ce que le bus demande à
JetStream comme nats-server 2.15 : flux à rétention par limites et leur fenêtre de déduplication,
consommateurs durables en *pull* avec acquittement explicite, `ack_wait`, `max_deliver`, `-NAK`
différé, `+TERM`, lectures directes, erreurs 10058, 10059, 10148 et 10026. Avec
`DDD_TS_KIT_TEST_NATS_URL`, les mêmes suites tournent une seconde fois contre un vrai serveur, ce
qui garde celui en mémoire fidèle :

```
docker run -d --rm --name ddd-ts-kit-test-nats -p 127.0.0.1:4222:4222 nats:2.15.0-alpine -js
DDD_TS_KIT_TEST_NATS_URL=nats://127.0.0.1:4222 npx vitest run packages/nats
docker rm -f ddd-ts-kit-test-nats
```

Le *job* d'intégration de la CI les exécute contre un vrai serveur sur chaque *pull request* qui atteint ce *package*,
contre NATS Server 2.15.0 avec JetStream que démarre `pipeline/github/scripts/start-nats.sh`, son image épinglée par *digest*.

Elles exécutent la suite de contrat sur le stockage fichier et sur le stockage mémoire, puis les
comportements de ce fournisseur, une suite par comportement (`publishing`, avec la déduplication
dans et hors de la fenêtre de déduplication, `consuming`, `correlation`, `retries`,
`dead-letters`, `topology`, `connection-loss` à travers un relais TCP que le test coupe,
`closing`), et toute la chaîne de l'outbox jusqu'à un consommateur idempotent. Chaque test
travaille sur ses propres flux et les supprime.
