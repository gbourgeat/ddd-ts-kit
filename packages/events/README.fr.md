[English](README.md) · **Français**
<!-- translation-of: README.md sha256:d6dececf74c0163f -->

# @ddd-ts-kit/events

Les événements d'intégration entre contextes délimités (bounded contexts), indépendants de tout
*broker* : des déclarations typées, un registre, une publication et une consommation validées,
une outbox transactionnelle, ainsi que le document AsyncAPI et le catalogue d'événements générés
à partir des déclarations.

```
npm i @ddd-ts-kit/events @ddd-ts-kit/validation zod
```

![Un événement d'intégration à travers le package : dans la transaction de la commande, l'agrégat enregistre un événement du domaine, son publisher crée l'événement d'intégration à partir de sa déclaration et le publie vers le port IntegrationEventPublisher, lié à l'OutboxPublisher, qui ajoute un enregistrement en attente à la table outbox ; après la validation, l'OutboxRelay réclame l'enregistrement et le publie vers le broker ou le bus en mémoire, qui le livre au moins une fois à consume dans le contexte consommateur, qui le déduplique et lance le gestionnaire, ici la commande IssueInvoice. Une seule déclaration alimente le producteur, le consommateur, le registre, le document AsyncAPI et le catalogue](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/events-package-place.fr.svg)

## Ce que contient le package

| Étape | À quoi elle sert | Exports |
|---|---|---|
| Déclarer | le contrat d'un événement et d'une version, qui appartient au producteur | `defineIntegrationEvent`, `PayloadOf` |
| Enregistrer | tous les événements qu'un système publie, pour valider ce qui sort et générer les documents | `createEventRegistry`, `EventRegistry`, `validatingPublisher` |
| Stocker | écrire l'événement dans la transaction de la commande | `OutboxPublisher`, le port `OutboxStore`, `InMemoryOutboxStore` |
| Relayer | publier ce qui a été stocké, après la validation (commit), avec de nouvelles tentatives | `OutboxRelay`, le port `RelaySignal`, `InMemoryRelaySignal` |
| Consommer | un traitement typé, validé, dédupliqué | `consume`, `on`, `subscribeAll` |
| Documenter | le document AsyncAPI et le catalogue d'événements | `generateAsyncApi` (`@ddd-ts-kit/events/asyncapi`), `generateEventCatalog` |

Les concepts qui le sous-tendent sont dans [L'outbox transactionnelle](../../docs/concepts/transactional-outbox.fr.md),
[Livraison et idempotence](../../docs/concepts/delivery-and-idempotency.fr.md) et
[Versionnement des événements](../../docs/concepts/event-versioning.fr.md).

## Toute la boucle dans un seul processus

Tout ce qui suit est en mémoire, donc s'exécute tel quel : une déclaration, un consommateur,
l'outbox, le relais, et une nouvelle livraison que le consommateur absorbe. Une vraie application
remplace les pièces en mémoire par sa base de données et son *broker* ; le code du producteur et
celui du consommateur ne changent pas.

<!-- checked sample -->
```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { InMemoryEventBus, InMemoryProcessedEventStore, InMemoryUnitOfWork, SystemClock } from '@ddd-ts-kit/kernel';
import {
  consume,
  defineIntegrationEvent,
  InMemoryOutboxStore,
  OutboxPublisher,
  OutboxRelay,
  subscribeAll,
} from '@ddd-ts-kit/events';

// 1. Le contrat, déclaré une seule fois par le producteur.
const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: zodSchema(z.object({ orderId: z.string(), total: z.number().int() })),
});

// 2. Un consommateur d'un autre contexte : dédupliqué, dans une seule unité de travail.
const bus = new InMemoryEventBus();
const invoiced: string[] = [];

subscribeAll(bus, [
  consume(
    orderPlaced,
    {
      consumer: 'billing.invoice-on-order-placed',
      processed: new InMemoryProcessedEventStore(),
      unitOfWork: new InMemoryUnitOfWork(),
    },
    async (event) => {
      invoiced.push(event.payload.orderId); // typé : { orderId: string; total: number }
    },
  ),
]);

// 3. Le producteur ne fait que stocker : rien ne part encore.
const store = new InMemoryOutboxStore();
const event = orderPlaced.create({ orderId: 'order-1', total: 3000 }, { id: 'evt-1', occurredAt: new Date() });

await new OutboxPublisher(store).publish([event]);
console.log(await store.stats()); // { pending: 1, failed: 0, dead: 0 }

// 4. Le relais publie ce qui a été stocké, puis le marque publié.
const relay = new OutboxRelay({ store, publisher: bus, clock: new SystemClock() });

console.log(await relay.tick()); // { published: 1, failed: 0 }

// 5. Le même événement livré une seconde fois est absorbé par le consommateur.
await bus.publish([event]);
console.log(invoiced); // [ 'order-1' ]
```

Les sections qui suivent reprennent chaque étape, telle qu'une vraie application l'écrit.

## Déclarer

Une déclaration par événement et par version, dans le `published-language/` du producteur. Elle
donne le type de la charge utile (payload), valide ce qui est publié et consommé, et alimente
les générateurs.

<!-- checked sample -->
```ts
// contexts/ordering/published-language/order-placed.v1.integration-event.ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';

export const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed', // <context>.<aggregate>.<fact>, segments en kebab-case
  version: 1,
  description: 'An order was placed by a customer.',
  payload: zodSchema(
    z.object({
      orderId: z.string().describe('Identifier of the order.'),
      total: z.object({ amount: z.number().int(), currency: z.enum(['EUR', 'USD']) }),
      lines: z.array(z.object({ sku: z.string(), quantity: z.number().int().positive() })),
    }),
  ),
});

export type OrderPlaced = PayloadOf<typeof orderPlaced>;
```

Le type est vérifié au chargement du module : trois segments en kebab-case,
`<context>.<aggregate>.<fact>`, et une version entière positive, sinon `defineIntegrationEvent`
lève `InvalidEventDefinitionError`. Le producteur est le premier segment du type, sauf si
`producer` le nomme. La déclaration répond ensuite à trois questions, une par côté :

| Membre | Côté | Ce qu'il fait |
|---|---|---|
| `create(payload, { id, occurredAt, correlationId?, traceparent? })` | producteur | valide la charge utile et construit l'enveloppe ; lève `InvalidEventPayloadError`, car publier un événement invalide est un bug |
| `parse(event)` | consommateur | vérifie le type, la version et la charge utile et renvoie un `Result` ; ne lève jamais d'exception |
| `is(event)` | l'un ou l'autre | une garde peu coûteuse sur le type et la version seulement, pour une charge utile déjà digne de confiance |

Un changement cassant est une nouvelle déclaration avec `version: 2` ; marquez l'ancienne
`deprecated: true` et continuez de publier les deux jusqu'à ce que les consommateurs aient migré.
Au lieu de changer la charge utile de `version: 1` dans le dos de ses consommateurs :

<!-- checked sample -->
```ts
// contexts/ordering/published-language/order-placed.v2.integration-event.ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent } from '@ddd-ts-kit/events';

// `amount` renommé `minorUnits`, toute devise ISO acceptée : un consommateur de la version 1 casserait, donc une nouvelle version.
export const orderPlacedV2 = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 2,
  description: 'An order was placed by a customer.',
  payload: zodSchema(
    z.object({
      orderId: z.string(),
      total: z.object({ minorUnits: z.number().int(), currency: z.string().length(3) }),
    }),
  ),
});

// order-placed.v1.integration-event.ts garde sa charge utile et gagne `deprecated: true` ;
// le publisher publie les deux versions jusqu'à ce qu'aucun consommateur ne lise la version 1.
```

Un consommateur abonné à la version 1 ignore la version 2, et inversement : les deux cohabitent.
Le document AsyncAPI liste les deux versions sur le canal du type, et le catalogue marque celle
qui est dépréciée.

## Publier par l'outbox

Un *publisher* est un gestionnaire d'un événement du domaine de son propre contexte : il traduit
le fait en charge utile publique et publie vers un `IntegrationEventPublisher`, sans rien savoir
d'autre. Avec une base de données, ce *publisher* est l'`OutboxPublisher` : il ne fait que
stocker. Les événements du domaine sont distribués à la fin de l'unité de travail de la
commande, avant sa validation (la phase `before-commit`, celle par défaut), si bien que
l'événement d'intégration est validé ou annulé avec l'écriture métier : le relais le publie
après la validation, jamais pour une commande annulée. Un *publisher* n'est jamais déclaré
`phase: 'after-commit'` : la transaction qui porterait sa ligne d'outbox est terminée.

```ts
// contexts/ordering/application/integration/publishers/order-placed.publisher.ts
import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

@DomainEventHandler(OrderPlacedEvent)
export class OrderPlacedPublisher implements DomainEventHandler<OrderPlacedEvent> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    const published = orderPlaced.create(
      { orderId: event.aggregateId, total: event.total, lines: event.lines },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    ); // lève InvalidEventPayloadError : publier un événement invalide est un bug

    await this.publisher.publish([published]);
  }
}
```

L'identifiant de corrélation ne se passe pas à la main : `scopedPublisher` l'appose (voir « Le
contexte d'exécution d'un événement consommé »).

Le *publisher* connaît le port, jamais le transport. Au lieu de parler à un *broker* depuis le
gestionnaire, ce qui envoie l'événement même quand la transaction est ensuite annulée :

```ts
// Signalé par events/outbox-required : l'événement part avant la validation, ou sans elle.
export class OrderPlacedPublisher {
  constructor(private readonly bus: RabbitMqEventBus) {}
}
```

écrivez vers `IntegrationEventPublisher`, comme ci-dessus, et laissez la racine de composition
décider où il va. La règle `events/outbox-required` signale deux choses. Dans `domain/` ou
`application/`, l'import d'un client de *broker*, de n'importe quel bus d'événements (le port
`EventBus` du noyau compris), de `OutboxRelay`, de `OutboxPublisher` ou de `OutboxStore`. Dans
`application/integration/publishers/`, un paramètre de constructeur typé comme un bus ou un relais
(un type dont le nom finit par `EventBus` ou `Relay`) : c'est ainsi que l'exemple ci-dessus est
signalé, avec ou sans import.

La racine de composition lie le stockage sous son port, `OutboxStore`, et remet l'outbox au
module du noyau comme *publisher* qu'utilisent les gestionnaires. Les ports sont des classes
abstraites, et c'est la classe qu'un module lie et résout :

```ts
// platform/messaging.module.ts
import { defineContextModule } from '@ddd-ts-kit/di';
import { OutboxStore } from '@ddd-ts-kit/events';

export const messagingModule = defineContextModule({
  name: 'messaging',
  register(builder) {
    // L'adaptateur de votre base de données, ou InMemoryOutboxStore dans un seul processus.
    builder.bind(OutboxStore).toClass(SqlOutboxStore, [Database]);
  },
});
```

<!-- checked sample -->
```ts
// main.ts
import { createApplication, kernelModule, type ContextModule } from '@ddd-ts-kit/di';
import { Clock, ExecutionScope, Logger, scopedPublisher, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import {
  createEventRegistry,
  OutboxPublisher,
  OutboxRelay,
  OutboxStore,
  validatingPublisher,
  type AnyIntegrationEventDefinition,
} from '@ddd-ts-kit/events';

// Écrits ailleurs dans le projet.
declare const persistenceModule: ContextModule, messagingModule: ContextModule, orderingModule: ContextModule;
declare const orderPlaced: AnyIntegrationEventDefinition, invoiceIssued: AnyIntegrationEventDefinition;
declare const broker: IntegrationEventPublisher; // le vrai fournisseur : un adaptateur de broker, ou le bus en mémoire

const registry = createEventRegistry([orderPlaced, invoiceIssued]);

const app = createApplication({
  modules: [
    kernelModule({
      // Ce vers quoi publient les gestionnaires : l'outbox, derrière le registre, avec la corrélation apposée.
      eventPublisher: (resolve) =>
        scopedPublisher(
          validatingPublisher(new OutboxPublisher(resolve(OutboxStore)), registry, { unknown: 'reject' }),
          resolve(ExecutionScope),
        ),
    }),
    persistenceModule,
    messagingModule,
    orderingModule,
  ],
});
const logger = app.resolve(Logger);

const relay = new OutboxRelay({
  store: app.resolve(OutboxStore),
  publisher: broker,
  clock: app.resolve(Clock),
  maxAttempts: 8,
  onFailure: (failure) => logger.warn('outbox relay failure', { ...failure }), // des codes seulement, jamais un message d'erreur
});
relay.start({ intervalMs: 500 });
process.on('SIGTERM', () => void relay.stop()); // attend la fin du tour en cours
```

Donnez l'outbox à `kernelModule({ eventPublisher })` plutôt que de lier de nouveau
`IntegrationEventPublisher` dans un module ultérieur : l'`instrumentation` du module du noyau
enveloppe le *publisher* qu'il lie, et celui-là seulement ; un *publisher* lié ailleurs n'a donc
pas de *span* `outbox append` et ne stocke aucun `traceparent` avec ses événements.

Un adaptateur `implements OutboxStore` et ne l'étend jamais : le port n'a que des membres
abstraits. Sans conteneur, les mêmes objets se construisent à la main :
`new OutboxPublisher(store)`, `new OutboxRelay({ store, publisher: broker, clock })`.

L'outbox porte aussi les demandes de purge des caches HTTP (`CacheInvalidation` du noyau) : le
relais publie par `new PurgingPublisher(purger, broker)`, qui les remet au `CachePurger` au lieu
du *broker*. Voir « Tags de cache et purge après la validation » dans le README de
`@ddd-ts-kit/http`.

`relay.tick()` réclame un lot, publie chaque événement, le marque publié, ou planifie une
nouvelle tentative avec une attente exponentielle (backoff) ; après `maxAttempts`,
l'enregistrement est `dead` jusqu'à `store.retryDead(ids, now)`. `store.stats()` donne
`{ pending, failed, dead }` pour une vérification de santé, `store.purgePublished(before)` garde
la table petite.

![La vie d'un enregistrement de l'outbox : ajouté en attente par la validation de la commande, réclamé par le relais quand il est dû, publié puis purgé ; une publication en échec le laisse en attente jusqu'à sa tentative suivante, après une attente exponentielle ; après maxAttempts tentatives, il est mort jusqu'à ce que retryDead le remette en attente](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/transactional-outbox-record-lifecycle.fr.svg)

Le relais publie les enregistrements d'un lot un par un, si bien qu'un événement refusé par le
fournisseur ne fait pas échouer ses voisins. Avec les valeurs par défaut (`baseMs: 1000`,
`factor: 2`, `maxMs: 300000`, `maxAttempts: 8`), un enregistrement qui échoue toujours suit ce
parcours :

| Tentative en échec | Tentative suivante | Ce que reçoit `onFailure` |
|---|---|---|
| 1 | 1 s plus tard | `{ kind: 'publish', eventId, eventType, code, attempts: 1, dead: false }` |
| 2 | 2 s plus tard | `attempts: 2, dead: false` |
| 3 à 7 | 4, 8, 16, 32, puis 64 s plus tard | `attempts` de 3 à 7, `dead: false` |
| 8 | aucune : l'enregistrement est `dead` | `attempts: 8, dead: true` |

Le délai vaut `min(maxMs, baseMs * factor ** (attempts - 1))` ; passez
`backoff: { baseMs, factor, maxMs }` pour le changer. `code` est le `code` de l'erreur quand il a
la forme d'un identifiant, sinon le nom de sa classe : jamais son message, qui peut citer la
charge utile, si bien que `onFailure` peut être journalisé tel quel.

**Le traçage à travers l'outbox.** L'enveloppe porte `traceparent`, et chaque stockage d'outbox
le persiste et le restitue exactement (la suite de contrat le vérifie). Avec
`kernelModule({ instrumentation: traceApplication(), eventPublisher: outbox })`, le contexte de
la requête HTTP est apposé quand l'événement est ajouté, et
`new OutboxRelay({ store, publisher: tracedPublisher(broker), clock })` poursuit cette trace
quand il publie plus tard : le relais n'a pas de *span* à lui, et un tour qui ne publie rien
n'en crée aucun. `OutboxPublisher` se nomme lui-même `messagingSystem: 'outbox'`, ce que
`validatingPublisher` et `scopedPublisher` transmettent. Voir le README de
`@ddd-ts-kit/tracing`.

La livraison est au moins une fois. **Par défaut, l'ordre n'est pas garanti, pas même par
agrégat** : un événement en échec est retenté pendant que ses successeurs partent, et plusieurs
relais peuvent tourner côte à côte. Quand l'ordre compte, portez une séquence ou une version dans
la charge utile, ou demandez-le au relais (ci-dessous).

### Réveiller le relais au lieu d'interroger souvent

Un relais peut dormir sur un long intervalle et publier quand même tout de suite, quand le
stockage lui signale qu'un ajout a eu lieu. `wakeOn` prend un `RelaySignal`, un port d'une seule
méthode (`subscribe(listener): { unsubscribe() }`) : `LISTEN/NOTIFY` de PostgreSQL, un flux de
changements (change stream), ou `InMemoryRelaySignal` dans un seul processus. Un module le lie
comme le stockage, `builder.bind(RelaySignal).toClass(PostgresRelaySignal, [Database])`, et le
relais prend `wakeOn: app.resolve(RelaySignal)`.

```ts
const signal = new InMemoryRelaySignal();
const store = new InMemoryOutboxStore({ signal }); // notifie après chaque ajout
const relay = new OutboxRelay({ store, publisher: broker, clock, wakeOn: signal });
relay.start({ intervalMs: 30_000 }); // l'intervalle n'est plus que le filet de sécurité
```

Les rafales sont regroupées : un tour s'exécute, au plus un autre est mis en file, quel que soit
le nombre de notifications. **L'interrogation périodique (polling) reste le filet de
sécurité** : un signal est un indice, et une notification manquée pendant que l'écouteur se
reconnecte ou que le processus redémarre ne doit que retarder la publication jusqu'à l'intervalle
suivant, jamais la perdre. Gardez donc `intervalMs` au plus long délai que vous acceptez dans ce
cas, et ne vous fiez jamais au seul signal. Un stockage transactionnel doit notifier après la
validation (PostgreSQL le fait de lui-même : `NOTIFY` est délivré à la validation).

### L'ordre par clé

```ts
const relay = new OutboxRelay({
  store,
  publisher: broker,
  clock,
  ordering: 'per-key',
  keyOf: (event) => (orderPlaced.is(event) ? event.payload.orderId : undefined),
});
```

Avec `ordering: 'per-key'`, un enregistrement n'est jamais publié tant qu'un enregistrement
antérieur de même clé est encore en attente ou en échec. Le prix est le blocage en tête de file
(head-of-line blocking) : un événement qui ne peut pas être publié retient tous les événements
suivants de sa clé (et de sa clé seulement) jusqu'à ce qu'il parte ou soit mort. Les événements
pour lesquels `keyOf` donne `undefined` ne sont pas ordonnés.

![Cinq enregistrements dans l'outbox, dans l'ordre de leur ajout : A1, A2, B1, A3, B2, où A est la clé order-1 et B la clé order-2, et la publication de A1 échoue. Avec l'ordre par défaut, A2, B1, A3 et B2 sont publiés dans le même tour et A1 est retenté plus tard, si bien que A2 et A3 doublent A1. Avec l'ordre per-key, B1 et B2 sont publiés, A2 et A3 sont retenus avec le code OUTBOX_HELD_FOR_ORDER, et une fois A1 parti lors de sa nouvelle tentative, A2 puis A3 suivent dans l'ordre](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/events-package-per-key-ordering.fr.svg)

Ce sur quoi il repose, et ce qu'il ne donne pas :

- **Faites tourner un seul relais.** La mémoire de quel enregistrement bloque quelle clé vit dans
  le relais, pas dans le stockage : le port `OutboxStore` est inchangé, et `claimBatch` seul ne
  peut pas savoir qu'un enregistrement antérieur attend sa nouvelle tentative. Deux relais côte à
  côte publient en concurrence.
- **Un redémarrage l'oublie.** Si le processus redémarre pendant qu'un enregistrement est en
  attente exponentielle ou sous bail, un enregistrement ultérieur de même clé qui devient dû le
  premier est publié le premier, une fois. Un ordre strict à travers les redémarrages exige la
  clé stockée avec l'enregistrement et une réclamation qui saute les clés ayant une ligne
  antérieure non publiée : un changement du port et de la table, qui n'est pas fait ici.
- Un enregistrement retenu est replanifié avec la tête de sa clé et apparaît dans
  `stats().failed` avec le code `OUTBOX_HELD_FOR_ORDER` ; les réclamations qu'il passe à attendre
  ne sont pas comptées comme des tentatives de livraison par ce relais.
- Un enregistrement **mort** cesse de bloquer sa clé (`onFailure` le signale avec `dead: true`).
  Réglez `maxAttempts: Infinity` si une clé doit plutôt rester bloquée que sauter un événement.
- Le *broker* et le consommateur doivent eux aussi garder l'ordre : une partition ou une file
  d'attente avec un seul consommateur actif par clé, et un consommateur qui ne retente pas dans
  le désordre.

Un `OutboxStore` accorde un bail sur ce qu'il remet : `claimBatch` masque les enregistrements
réclamés pendant le bail du stockage, si bien qu'un relais qui meurt les laisse revenir. Les
adaptateurs sont tenus par `outboxStoreContract` de `@ddd-ts-kit/testing/contracts`.

## Consommer de façon idempotente

Avec `@ddd-ts-kit/di`, un gestionnaire d'événement d'intégration déclaré est idempotent sans
rien écrire : sa marque d'idempotence et son travail s'exécutent dans une seule unité de travail
dès qu'un `UnitOfWork` et un `ProcessedEventStore` sont liés, ce que fait `kernelModule()`. La
racine de composition ne construit aucun gestionnaire à la main :

```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import { CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { orderPlaced, type OrderPlaced } from '@/contexts/ordering/published-language';

@IntegrationEventHandler(orderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlaced>): Promise<void> {
    await this.commands.execute(new IssueInvoice(event.payload.orderId, event.payload.total));
  }
}
```

`consume` est l'outil d'un projet qui câble sans di. Au lieu d'abonner une simple fonction de
rappel, qui traite une seconde fois un événement livré de nouveau et émet une seconde facture :

```ts
// Signalé par events/consumer-idempotent dans application/ et dans le fichier du module :
// pas de nom de consommateur, pas de stockage des événements traités, et une charge utile ni typée ni validée.
subscriber.subscribe(orderPlaced.type, async (event) => {
  const { orderId, total } = event.payload as OrderPlaced;
  await commandBus.execute(new IssueInvoice(orderId, total));
});
```

donnez à une simple fonction la même sémantique qu'au gestionnaire déclaré :

```ts
// contexts/billing/billing.subscriptions.ts
import { consume, subscribeAll } from '@ddd-ts-kit/events';

export const billingSubscriptions = ({ commandBus, processed, unitOfWork }: BillingDependencies) => [
  consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork }, async (event) => {
    await commandBus.execute(new IssueInvoice(event.payload.orderId, event.payload.total));
  }),
];

// main.ts
const subscription = subscribeAll(subscriber, billingSubscriptions(dependencies));
```

Le gestionnaire reçoit un événement typé et validé. Un événement d'une autre version du même type
est ignoré (abonnez-vous-y avec sa propre déclaration) ; une charge utile invalide lève une
exception, si bien que le fournisseur retente ou envoie en file de rejet (dead letter).

`consume` exécute la déduplication et le gestionnaire dans **une seule unité de travail** : la
marque dans le stockage des événements traités et le changement d'état du consommateur sont
validés ensemble. Une nouvelle livraison est traitée une fois par consommateur, et un événement
dont le gestionnaire a levé une exception est traité de nouveau quand il revient, car sa marque a
été annulée avec le reste. Le *middleware* du bus de commandes rejoint cette unité de travail (un
`run` imbriqué rejoint la transaction englobante), si bien que le gestionnaire n'a besoin de rien
de particulier.

![Une livraison à travers consume : la déclaration analyse l'événement ; un autre type ou une autre version est ignoré sans marque ; une charge utile invalide lève InvalidEventPayloadError, si bien que le fournisseur la retente ou l'envoie en file de rejet. Un événement valide entre dans une seule unité de travail, dans la portée d'exécution quand elle est fournie : le stockage des événements traités marque le couple du consommateur et de l'identifiant de l'événement ; quand le couple était déjà marqué, le gestionnaire est sauté ; sinon le gestionnaire s'exécute, et son succès valide la marque avec le changement d'état, tandis que son échec annule les deux, si bien que la nouvelle livraison est traitée](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/events-package-consume.fr.svg)

Le nom du consommateur est la portée de l'idempotence : deux consommateurs du même événement le
traitent chacun une fois, et renommer un consommateur lui fait traiter de nouveau chaque
événement qui lui est relivré. Écrivez-le une fois, sous la forme `<context>.<reaction>`, et ne le
dérivez jamais.

`on(definition, handler, { consumer, processed, unitOfWork })` est la même chose avec des parties
facultatives, pour un consommateur qui n'a pas besoin de déduplication ou n'a pas de transaction.
Attention à un cas : avec `processed` et sans `unitOfWork`, la marque est posée avant que le
gestionnaire s'exécute. Si le gestionnaire échoue ensuite, un stockage transactionnel garde la
marque (elle a été validée seule) et la nouvelle livraison est ignorée : l'événement est perdu
pour ce consommateur. Sans base de données, utilisez un stockage qui peut retirer sa marque, un
`ReleasableProcessedEventStore` comme l'`InMemoryProcessedEventStore` du noyau : `on` et
`consume` libèrent la marque d'un gestionnaire qui a échoué. `ReleasableProcessedEventStore` est
un type, pas un port à part entière : c'est le port `ProcessedEventStore` du noyau avec son
`release` facultatif rendu obligatoire, et un tel stockage se lie sous `ProcessedEventStore`.

### Le contexte d'exécution d'un événement consommé

`consume` et `on` prennent l'`ExecutionScope` du noyau et exécutent tout, l'unité de travail et
la marque d'idempotence comprises, à l'intérieur :

```ts
consume(orderPlaced, { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork, scope }, handler);
```

| Champ du contexte | Valeur |
|---|---|
| `origin` | `event` |
| `correlationId` | le `correlationId` de l'événement, ou son `id` quand il n'en nomme aucun |
| `causationId` | l'`id` de l'événement |
| `actor` | `systemActor(consumer)`, sauf si `actorOf(event)` en renvoie un |
| `tenantId` | le `tenantId` de l'événement, quand il en nomme un : le consommateur ne lit et n'écrit que dans ce *tenant* |

Ainsi, les *repositories* du contexte consommateur remplissent les colonnes d'audit avec
`system:billing.invoice-on-order-placed`, et une ligne de journal du consommateur porte la
corrélation de la requête HTTP qui a tout déclenché. L'enveloppe ne porte aucun acteur par
défaut, à dessein : un acteur est une donnée personnelle, et un *broker* conserve les messages.
Un projet qui décide de mettre une référence dans sa propre charge utile ou sa propre enveloppe
la traduit avec `actorOf: (event) => Actor | undefined`.

Côté publication, `scopedPublisher` du noyau remplit la corrélation, et le *tenant* du travail
en cours, si bien que les cas d'usage ne les passent jamais à la main. C'est l'enveloppe la plus
externe du *publisher* donné à `kernelModule` dans le `main.ts` ci-dessus :

```ts
eventPublisher: (resolve) => scopedPublisher(new OutboxPublisher(resolve(OutboxStore)), resolve(ExecutionScope)),
```

Un événement créé avec un `correlationId` ou un `tenantId` le garde ; un événement publié hors de
tout contexte d'exécution est laissé tel quel. C'est un décorateur, pas une option
d'`OutboxPublisher` ni de `defineIntegrationEvent(...).create` : les deux restent purs, et
l'apposition s'applique à tout fournisseur.

## Générer le document AsyncAPI et le catalogue

<!-- checked sample -->
```ts
// scripts/generate-contracts.ts
import { readFile, writeFile } from 'node:fs/promises';
import { generateEventCatalog, type EventRegistry } from '@ddd-ts-kit/events';
import { checkAsyncApiDrift, generateAsyncApi, stringifyAsyncApi } from '@ddd-ts-kit/events/asyncapi';

declare const registry: EventRegistry; // createEventRegistry([...toutes les déclarations publiées])

const document = generateAsyncApi({
  info: { title: 'Shop events', version: '1.4.0' },
  registry,
  servers: { production: { host: 'broker.example.com:5671', protocol: 'amqps' } },
});
await writeFile('docs/integration/asyncapi.json', stringifyAsyncApi(document));
await writeFile(
  'docs/integration/event-catalog.md',
  generateEventCatalog(registry, { consumers: { 'ordering.order.placed': ['billing', 'shipping'] } }),
);

// En CI : échouer quand le fichier commité est périmé.
if (checkAsyncApiDrift(document, await readFile('docs/integration/asyncapi.json', 'utf8')).drift) {
  process.exit(1);
}
```

`stringifyAsyncApi` écrit du JSON indenté de deux espaces. Un projet généré par la CLI commite
plutôt `docs/integration/asyncapi.yaml`, écrit par `stringifyContract(document, 'yaml')` de
`ddd-ts-kit/dist/contracts.js` dans son `scripts/events.ts` (`openapi.format: json` de sa
configuration garde le JSON).

Le document AsyncAPI 3.0.0 a un canal par type d'événement (son adresse est le type), un message
par version dont la charge utile est l'enveloppe (`id`, `type`, `version`, `occurredAt`,
`payload`, `traceparent`, `correlationId`), et une opération `send` par canal. Le catalogue est
en Markdown : une section par producteur, un tableau des versions par événement, et les champs
de la charge utile mis à plat (`customer.email`, `lines[].sku`). Les deux sorties ne dépendent
que des déclarations, jamais de leur ordre d'enregistrement, si bien qu'on peut les commiter et
les comparer.
Un projet généré par la CLI a ce script sous le nom `scripts/events.ts`, avec les deux mêmes
chemins.

## Choisir la stratégie pour votre transport

Il n'y a qu'une règle, quels que soient les outils : le gestionnaire écrit l'événement dans
l'outbox dans la transaction de la commande, un relais le publie ensuite, le consommateur
déduplique. Ce qui change avec le transport, c'est la façon dont le relais tourne et ce que le
côté consommateur doit faire.

| Transport | Relais | Côté consommateur |
|---|---|---|
| même processus, sans *broker* | relais par interrogation périodique vers le bus en mémoire (ou réveillé par la base de données : `LISTEN/NOTIFY` de PostgreSQL) | stockage des événements traités dans la transaction du consommateur |
| RabbitMQ et autres *brokers* à files d'attente | relais par interrogation périodique qui publie avec confirmations de publication (publisher confirms), marquage publié à la confirmation | une file d'attente durable par consommateur, acquittement manuel après la validation, échange de rejet (dead-letter exchange) après un nombre borné de nouvelles tentatives |
| Kafka et autres journaux | relais par interrogation périodique, ou capture des changements de données (change data capture) qui lit la table outbox (outbox router de Debezium) ; clé = identifiant de l'agrégat pour l'ordre par agrégat | un groupe de consommateurs par consommateur, *offset* validé après la transaction du gestionnaire, stockage des événements traités pour les nouvelles livraisons |
| files et sujets du cloud (SQS/SNS, Pub/Sub) | relais par interrogation périodique, publication par lots | délai de visibilité supérieur au pire cas du gestionnaire, politique de redirection (redrive policy) vers une file de rejet |

Sans base de données, il n'y a rien avec quoi être atomique : publiez directement vers le bus,
sans outbox.

Le kit a un *package* fournisseur pour RabbitMQ (`@ddd-ts-kit/rabbitmq`), Kafka
(`@ddd-ts-kit/kafka`), NATS JetStream (`@ddd-ts-kit/nats`) et Redis Streams
(`@ddd-ts-kit/redis/event-bus`) ; chaque README dit comment il remplit les exigences ci-dessous et
ce qu'il ne garantit pas.

### Même processus, sans broker

- **Mode du relais.** `OutboxRelay` qui publie vers l'`InMemoryEventBus`. Réveillez-le avec
  `wakeOn` (le signal en mémoire, ou `LISTEN/NOTIFY` sur PostgreSQL) et gardez un long intervalle
  comme filet de sécurité.
- **Exigences du publisher.** Aucune au-delà du port. Le bus en mémoire exécute les gestionnaires
  dans `publish` et rejette quand l'un d'eux échoue, avec une `AggregateError` par défaut ;
  construit avec `{ failures: 'as-thrown' }`, il rejette avec l'erreur du seul gestionnaire en
  échec telle quelle, et le relais enregistre son `code` (`CONCURRENCY_CONFLICT`) comme
  `lastErrorCode`. Le relais retente alors l'enregistrement, si bien que la politique de nouvelles
  tentatives des consommateurs EST l'attente exponentielle du relais.
- **Exigences du consommateur.** `consume` avec le stockage des événements traités et l'unité de
  travail du contexte consommateur. Une nouvelle livraison exécute de nouveau chaque gestionnaire
  du type, si bien que chacun d'eux déduplique.
- **Ordre.** `per-key` le donne ici sans rien d'autre à mettre en place : un relais, un
  processus, des gestionnaires attendus dans l'ordre (la réserve du relais sur le redémarrage
  s'applique toujours).
- **File de rejet.** L'outbox est le stockage des rejets : un enregistrement est `dead` après
  `maxAttempts`, et revient avec `store.retryDead(ids, now)`.
- **Surveiller.** `stats()` : `dead > 0` est une alerte ; un `failed` qui monte signifie qu'un
  consommateur échoue sans cesse ; l'âge de l'enregistrement en attente le plus ancien est le
  délai de livraison.

### Brokers à files d'attente (RabbitMQ, ActiveMQ)

- **Mode du relais.** Relais par interrogation périodique ou réveillé. L'enregistrement n'est
  marqué publié que lorsque le *broker* l'a confirmé.
- **Exigences du publisher.** `publish` ne doit se résoudre qu'à la confirmation du *broker*
  (publisher confirms) et rejeter sinon, avec des échanges durables et des messages persistants.
  Une confirmation perdue après que le *broker* a pris le message fait republier le relais : les
  doublons sont attendus. `@ddd-ts-kit/rabbitmq` met en œuvre cette ligne.
- **Exigences du consommateur.** Une file d'attente durable par consommateur et par type
  d'événement, un acquittement manuel après la validation de l'unité de travail du gestionnaire,
  `consume` pour la déduplication. N'acquittez jamais avant la validation.
- **Ordre.** Aucun par défaut : les nouvelles tentatives et les consommateurs concurrents
  réordonnent. Par clé seulement avec le relais `per-key` ET un seul consommateur actif sur la
  file ET aucune file de nouvelles tentatives, ce qui en vaut rarement la peine ; préférez une
  version dans la charge utile.
- **File de rejet.** Deux endroits. Côté publication : l'outbox (`dead`, `retryDead`). Côté
  consommation : un nombre borné de nouvelles tentatives différées, puis une file de rejet par
  file de consommateur.
- **Surveiller.** Les `stats()` de l'outbox, et sur le *broker* la profondeur de chaque file de
  travail (un consommateur qui prend du retard), de chaque file de rejet (qui doit être vide) et
  le nombre de messages non acquittés.

### Journaux (Kafka, Redpanda, Pulsar, Kinesis)

- **Mode du relais.** Relais par interrogation périodique, ou capture des changements de données
  (ci-dessous).
- **Exigences du publisher.** Un producteur idempotent avec `acks=all` ; `publish` se résout à
  l'acquittement de l'écriture. La clé du message est l'identifiant de l'agrégat, si bien qu'un
  agrégat vit dans une seule partition. Un sujet (topic) par type d'événement ou par contexte,
  choisi une fois pour toutes.
- **Exigences du consommateur.** Un groupe de consommateurs par contexte consommateur. L'*offset*
  est validé après la transaction du gestionnaire, jamais avant ; un plantage entre les deux
  provoque une nouvelle livraison, d'où le stockage des événements traités. Un gestionnaire qui
  échoue sans cesse bloque sa partition : retentez sur place un nombre borné de fois, puis
  publiez l'enregistrement vers un sujet de rejet et validez.
- **Ordre.** Par partition, donc par clé, pourvu que le relais le garde : `ordering: 'per-key'`
  avec un `keyOf` qui renvoie le même identifiant d'agrégat, un seul relais, et
  `max.in.flight.requests.per.connection` à 5 au plus avec l'idempotence activée.
- **File de rejet.** L'outbox côté publication, un sujet de rejet par groupe de consommateurs
  côté consommation.
- **Surveiller.** Les `stats()` de l'outbox, le retard des consommateurs par groupe et par
  partition, la taille du sujet de rejet.

### Files et sujets du cloud (SQS/SNS, Pub/Sub)

- **Mode du relais.** Relais par interrogation périodique. La publication par lots (10 entrées
  par appel sur SQS et SNS) est permise, mais le résultat est par entrée : publiez, puis rejetez
  si une entrée a échoué, pour que le relais retente ; les entrées qui sont passées sont publiées
  deux fois, ce que le consommateur absorbe.
- **Exigences du publisher.** Un sujet avec un abonnement (une file d'attente) par consommateur.
  `publish` se résout à l'acquittement du service. Les attributs du message portent le type, la
  version et la trace.
- **Exigences du consommateur.** Un délai de visibilité (ack deadline) supérieur au pire cas du
  gestionnaire, prolongé pendant son exécution si besoin ; supprimez (acquittez) le message après
  la validation. `consume` pour la déduplication : ces services livrent de nouveau par
  construction.
- **Ordre.** Aucun sur les files standard. Les files FIFO et les clés d'ordre le donnent par
  groupe de messages, au prix du débit, avec le relais `per-key` et l'identifiant de groupe =
  `keyOf`.
- **File de rejet.** L'outbox côté publication ; une politique de redirection
  (`maxReceiveCount`) vers une file de rejet par file de consommateur.
- **Surveiller.** Les `stats()` de l'outbox, l'âge du message le plus ancien par file, la
  profondeur de la file de rejet.

### Ce qu'il faut surveiller sur l'outbox

`store.stats()` donne `{ pending, failed, dead }` ; exposez-les comme des jauges.

| Signal | Sens | Réaction |
|---|---|---|
| `dead > 0` | des enregistrements ont abandonné après `maxAttempts` | alerte ; corrigez la cause, puis `retryDead` |
| `failed > 0` longtemps | le fournisseur refuse ou est hors service ; sous `per-key`, les enregistrements retenus comptent aussi ici (`OUTBOX_HELD_FOR_ORDER`) | regardez les codes donnés à `onFailure` |
| `pending` qui grossit | le relais est plus lent que les producteurs, ou arrêté | vérifiez qu'il tourne ; augmentez `batchSize` |
| âge de l'enregistrement en attente le plus ancien | le vrai délai de livraison | alerte au-delà de votre tolérance ; c'est une requête sur la table (`min(created_at) where status = 'pending'`), `stats()` ne le porte pas |
| `onFailure({ kind: 'tick' })` | le stockage lui-même a échoué | santé de la base de données |

Purgez régulièrement les enregistrements publiés (`purgePublished(before)`), sinon la table et
son index grossissent sans limite.

### Où se place la capture des changements de données

La capture des changements de données (Debezium et son outbox event router, ou un lecteur de
réplication logique) remplace **le relais, jamais la table**. Les gestionnaires écrivent toujours
l'événement dans la table outbox dans la transaction de la commande ; au lieu d'un processus qui
interroge cette table, la capture lit les mêmes lignes dans le journal des transactions de la
base de données et les publie, dans l'ordre des validations. Conséquences :

- rien ne change dans les gestionnaires, dans `OutboxPublisher` ni dans les consommateurs ;
- ne faites pas tourner un `OutboxRelay` sur la même table pour la même destination : l'un ou
  l'autre ;
- `status`, `attempts` et `next_attempt_at` ne sont plus tenus à jour : les nouvelles tentatives
  et les échecs sont ceux du connecteur, donc surveillez le connecteur (retard, tâches en échec)
  au lieu de `stats()`, et purgez par âge ;
- l'event router doit faire correspondre les colonnes : `id` à l'identifiant du message, `type`
  au sujet ou à la clé de routage, l'identifiant de l'agrégat à la clé du message, `payload` et
  les colonnes de trace au corps et aux en-têtes, pour que le consommateur reçoive la même
  enveloppe que depuis le relais ;
- l'ordre par clé vient gratuitement (le journal est ordonné), et c'est la principale raison de
  la choisir.

Écrire vers le *broker* depuis le gestionnaire et « capturer » plutôt les tables métier n'est
pas ce patron : cela publie des lignes, pas des événements, et couple les consommateurs au
schéma.
