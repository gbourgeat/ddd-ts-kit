[English](README.md) · **Français**
<!-- translation-of: README.md sha256:860413972237a22f -->

# @ddd-ts-kit/tracing

Un traçage OpenTelemetry que le domaine ne voit jamais. Rien dans `domain/` ni dans
`application/` n'importe ce *package* : les cas d'usage, les adaptateurs, les événements et les
*jobs* sont enveloppés là où ils sont câblés, dans la racine de composition, et une action de
l'utilisateur se lit comme une seule trace.

```
npm i @ddd-ts-kit/tracing @opentelemetry/api
# pour le démarrage Node (@ddd-ts-kit/tracing/node)
npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
# pour le banc de test (@ddd-ts-kit/tracing/testing)
npm i -D @opentelemetry/sdk-trace-base @opentelemetry/context-async-hooks
```

![La place du package : la plateforme enveloppe chaque endroit où le travail entre dans un contexte délimité ou en sort, et chaque enveloppe ouvre une sorte de span. tracedRoutes autour du pipeline HTTP ouvre le span SERVER de la requête HTTP. traceApplication, donné une fois à kernelModule, réunit les enveloppes qui ouvrent des spans : traceUseCases sur les bus ouvre les spans command et query, traceBindings sur les repositories, les gateways et les gestionnaires ouvre leurs spans, tracedDomainEvents sur le répartiteur des événements du domaine ouvre les spans unit-of-work et domain-event, tracedPublisher sur le publisher du noyau ouvre outbox append, tracedConsumer ouvre process, et tracedJob et tracedBackgroundJob ouvrent job ; il confie aussi au traçage le rapporteur d'erreurs et la portée d'exécution. tracedPublisher autour du publisher du relais de l'outbox ouvre publish. initTracing démarre le SDK OpenTelemetry avec ses instrumentations et ses processeurs de spans, et exporte en OTLP vers Jaeger ou un collecteur. Le code des contextes n'en importe rien](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/tracing-package-place.fr.svg)

Chaque *span* d'une trace est ouvert par l'un de ces quelques endroits, tous dans la plateforme.
Le domaine, l'application et les adaptateurs d'un contexte restent de simples classes, ce que
tient la règle `tracing/platform-only` : un import de `@ddd-ts-kit/tracing` ou de
`@opentelemetry/*` ailleurs sous la racine des sources est signalé. Au lieu d'ouvrir un *span*
dans un adaptateur :

```ts
// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
import { trace } from '@opentelemetry/api'; // signalé par tracing/platform-only

export class StripePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string): Promise<void> {
    await trace.getTracer('billing').startActiveSpan('charge', () => this.client.charge(invoiceId));
  }
}
```

écrivez l'adaptateur seul, et liez-le avec sa sorte : l'instrumentation du module du noyau
l'enveloppe, et chaque appel est un *span* `external PaymentGateway.charge` avec les mêmes
attributs que tout autre adaptateur.

```ts
export class StripePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string): Promise<void> {
    await this.client.charge(invoiceId);
  }
}

// le module du contexte, style explicite ; le style déclaré écrit plutôt
// @Adapter(PaymentGateway, { kind: 'external' }) sur la classe
builder.bind(PaymentGateway).toClass(StripePaymentGateway, [StripeClient]).as('external');
```

## Mise en place

```ts
// platform/tracing.ts : importé avant tout le reste
import { initTracing } from '@ddd-ts-kit/tracing/node';

export const tracing = initTracing({ serviceName: 'clinic-api' });
```

```ts
// main.ts
import { tracing } from '@/platform/tracing'; // premier import, voir « Ordre de chargement »
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
import { traceApplication, tracedPublisher, tracedRoutes } from '@ddd-ts-kit/tracing';

const app = createApplication({
  modules: [kernelModule({ instrumentation: traceApplication(), eventPublisher: outbox }), schedulingModule, notificationModule],
});

mountExpress(server, routes, { executionScope: app.resolve(ExecutionScope), around: tracedRoutes() });
new OutboxRelay({ store, publisher: tracedPublisher(bus), clock }).start({ intervalMs: 1_000 });

await app.start();
process.on('SIGTERM', () => void app.stop().then(() => tracing.shutdown()));
```

C'est tout : `traceApplication()` est la valeur dont `kernelModule` enveloppe l'application, et
aucune classe n'en sait rien. Trois endroits restent hors du module du noyau et prennent chacun
une enveloppe : le pipeline HTTP (`around: tracedRoutes()`), le *publisher* avec lequel un relais
de l'outbox envoie (`tracedPublisher(bus)`), et un projet qui construit son propre fournisseur de
traceurs (voir « Processeurs de spans »).

### Jaeger, en cinq lignes

Jaeger v2 reçoit l'OTLP nativement, il n'y a donc rien entre l'application et Jaeger :

```yaml
services:
  jaeger:
    image: jaegertracing/jaeger:2.22.0
    profiles: [observability]
    ports: ['127.0.0.1:16686:16686', '127.0.0.1:4318:4318']
```

```
docker compose --profile observability up -d jaeger
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 node dist/main.js
```

`initTracing({ serviceName })` n'a besoin de rien d'autre : le point d'accès (endpoint) vient de
la variable standard `OTEL_EXPORTER_OTLP_ENDPOINT` (ou `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`), et
sans aucune des deux rien n'est exporté. Ouvrez `http://127.0.0.1:16686` et cherchez le service.

### Ordre de chargement

L'auto-instrumentation modifie `http` et les pilotes de base de données au moment où ils sont
chargés, donc `initTracing` doit s'être exécuté avant. Dans un module ES, les imports statiques
sont évalués avant la première instruction du fichier : gardez l'appel dans son propre module et
importez ce module en premier (comme ci-dessus), ou préchargez-le avec
`node --import ./dist/platform/tracing.js`. Les *packages* publiés en modules ES ont aussi besoin
du *hook* de chargement `@opentelemetry/instrumentation`.

## À quoi ressemble une trace

Une requête HTTP qui réserve un rendez-vous, l'annonce à deux autres contextes délimités par
l'outbox, et est publiée par le relais un instant plus tard, depuis un minuteur et hors de toute
requête HTTP :

```
POST /appointments                                        SERVER    scheduling
  command BookAppointment                                 INTERNAL
    repository AppointmentRepository.findOverlapping      INTERNAL
    repository AppointmentRepository.save                 INTERNAL
    unit-of-work before-commit                            INTERNAL  après chaque enregistrement, avant la validation
      domain-event scheduling.appointment.booked          INTERNAL
        handler AppointmentBookedPublisher                INTERNAL
          outbox append scheduling.appointment.booked     INTERNAL  (la réponse part une fois ceci validé)
            publish scheduling.appointment.booked         PRODUCER  par le relais, plus tard, même trace
              process notification.appointment-booked     CONSUMER  notification
                command SendBookingConfirmation           INTERNAL
                  external MailGateway.send               INTERNAL
              process analytics.appointment-booked        CONSUMER  analytics
                command RecordBooking                     INTERNAL
                  repository BookingRepository.save       INTERNAL
```

Voici l'arbre tel qu'il est produit, vérifié *span* par *span* par
`test/scenarios/one-action-one-trace.spec.ts` et, contre un vrai Jaeger, par
`test/jaeger/real-jaeger.spec.ts`. Un *job* planifié est une trace à part entière :

```
job scheduling.send-reminders                             INTERNAL  (racine)
  command SendReminders                                   INTERNAL
    repository AppointmentRepository.findOverlapping      INTERNAL
```

### Les phases d'une unité de travail

Les gestionnaires d'événements du domaine ne sont pas sous l'enregistrement qui a consigné
l'événement : l'unité de travail les distribue une fois que le gestionnaire de la commande a
rendu la main. Sous le *span* de la commande, dans l'ordre :

```
command SendParcels                                       INTERNAL
  repository ParcelRepository.save                        INTERNAL
  repository ParcelRepository.save                        INTERNAL
  unit-of-work before-commit                              INTERNAL  les événements des deux enregistrements
    domain-event shipping.parcel.sent                     INTERNAL
      repository ParcelRepository.save                    INTERNAL  un gestionnaire enregistre un autre agrégat
    domain-event shipping.parcel.sent                     INTERNAL
  unit-of-work before-commit                              INTERNAL  ce que les gestionnaires ont consigné à leur tour
    domain-event shipping.parcel.tracked                  INTERNAL
  unit-of-work after-commit                               INTERNAL  une fois validé, même trace
    domain-event shipping.parcel.sent                     INTERNAL
    domain-event shipping.parcel.sent                     INTERNAL
```

- `unit-of-work before-commit` suit les *spans* d'enregistrement. Ce que les gestionnaires ont
  consigné à leur tour se trouve sous un second *span* du même nom.
- `unit-of-work after-commit` est présent quand un événement a un gestionnaire de cette phase, et
  ne contient que ces événements. C'est un enfant du *span* de la commande, et il reste dans la
  trace quand son gestionnaire échoue : le *span* de la commande dit toujours `succeeded`.
- Un gestionnaire déclaré avec une sorte (`@DomainEventHandler`) est un *span*
  `handler <ClassName>` sous son *span* `domain-event` ; une fonction de rappel attachée avec
  `dispatcher.on` n'en a pas.
- Hors de toute unité de travail (un *repository* appelé seul), les *spans* `domain-event`
  restent sous le *span* de l'enregistrement qui les a distribués, sans *span* de phase.

Cet arbre est vérifié par `test/unit-of-work-phases.spec.ts`.

### Noms, sortes et attributs des spans

| Span | Sorte | Créé par | Attributs |
|---|---|---|---|
| `<METHOD> <route template>` | SERVER | `tracedRoutes()` (renomme le *span* qu'une instrumentation HTTP a ouvert, ou en démarre un) | `http.route`, `http.request.method`, `http.response.status_code`, `app.operation`, `app.correlation_id`, `app.origin`, `app.outcome`, `app.error.code` |
| `command <Name>`, `query <Name>` | INTERNAL | `traceUseCases()`, un *middleware* du bus | `app.use_case.kind`, `app.use_case.name`, `app.context`, `app.outcome`, `app.error.code`, `error.type` |
| `<kind> <Port>.<method>` : `repository`, `gateway`, `external`, `publisher` | INTERNAL | `traceBindings()` | `code.namespace` (la classe de l'adaptateur), `code.function`, `app.dependency.kind`, `app.context` |
| `unit-of-work before-commit` | INTERNAL | `tracedDomainEvents()`, autour de chaque vague d'événements distribués à la fin d'une unité de travail, avant la validation (commit) | aucun |
| `unit-of-work after-commit` | INTERNAL | `tracedDomainEvents()`, autour des événements qui ont un gestionnaire `after-commit`, une fois l'unité de travail validée | aucun |
| `domain-event <name>` | INTERNAL | `tracedDomainEvents()` | `app.domain_event.name` |
| `handler <ClassName>` | INTERNAL | `traceBindings()`, sorte `domain-event-handler` | `code.namespace`, `code.function`, `app.dependency.kind`, `app.context` |
| `outbox append <type>` | INTERNAL | `tracedPublisher()` autour d'un *publisher* qui stocke | `messaging.system` (`outbox`), `messaging.operation.name` (`append`), `messaging.operation.type` (`create`), `messaging.destination.name`, `messaging.message.id` |
| `publish <type>` | PRODUCER | `tracedPublisher()` autour d'un bus | `messaging.system`, `messaging.operation.name` (`publish`), `messaging.operation.type` (`send`), `messaging.destination.name`, `messaging.message.id` |
| `process <consumer>` | CONSUMER | `tracedConsumer()`, un par livraison | `messaging.system`, `messaging.operation.*` (`process`), `messaging.destination.name`, `messaging.message.id`, `messaging.consumer.group.name`, `app.messaging.source`, `app.messaging.attempt`, `app.messaging.redelivered`, `app.context`, `app.correlation_id`, `app.origin`, `app.outcome` |
| `job <name>` | INTERNAL, toujours une racine | `tracedJob()` | `app.job.name`, `app.job.scheduled_at`, `app.job.attempt`, `app.context`, `app.correlation_id`, `app.origin`, `app.outcome` |
| `job <name>` d'un *job* en arrière-plan | CONSUMER, enfant du *span* qui l'a mis en file | `tracedBackgroundJob()`, un par tentative ; `traceparent()` (`captureTraceparent`) est stocké avec le *job* quand il est mis en file | `app.job.name`, `app.job.id`, `app.job.attempt`, `app.context`, `app.correlation_id`, `app.origin` (`queue`), `app.outcome` |

- Les noms sont stables et de faible cardinalité : un gabarit de route, jamais une URL ; une
  classe, un port, un type d'événement ou un nom de consommateur, jamais un identifiant.
- `app.outcome` vaut `succeeded`, `refused` (une réponse métier), `failed`, et pour une livraison
  `dead-lettered`. Une `DomainError` est une réponse, pas un incident : le *span* du cas d'usage
  dit `refused` et `app.error.code`, et n'est pas une erreur. Tout le reste met le statut ERROR
  avec `error.type` (le nom de la classe) et `app.error.code` (le `code`, quand il en a la forme).
- **Une requête HTTP refusée par l'autorisation n'a pas de span de cas d'usage** : le
  *middleware* se place après la garde du cas d'usage, si bien que la trace se réduit au *span*
  SERVER, avec le statut renvoyé et le code (`FORBIDDEN`). Un cas d'usage refusé par ses propres
  règles a son *span*, `refused`.
- **Un seul mécanisme par span.** Un cas d'usage est tracé par le *middleware* du bus, un
  consommateur par `process <consumer>`, un *job* par `job <name>` : `traceBindings()` laisse de
  côté les liaisons de sorte `use-case`, `consumer` et `job`.
- **Vie privée** : classe, méthode, port, contexte, codes et les identifiants du kit
  (identifiant d'événement, identifiant de corrélation, nom de *job*). Jamais les arguments, les
  résultats, les charges utiles, les valeurs des paramètres SQL, les messages d'erreur, les
  identifiants d'agrégat, ni quoi que ce soit sur l'acteur ou le *tenant*.

### À travers la frontière asynchrone

Le contexte de trace est capturé quand l'événement d'intégration est créé, dans la requête HTTP :
`outbox append <type>` appose son propre `traceparent` sur l'événement, et l'outbox le stocke avec
l'enregistrement (chaque stockage d'outbox du kit le persiste et le restitue exactement : la
suite de contrat de `@ddd-ts-kit/testing` l'affirme pour les stockages en mémoire, Drizzle, Knex,
Prisma et TypeORM). Le relais publie plus tard, depuis une autre chaîne d'appels ou un autre
processus : `tracedPublisher(bus)` fait de `publish <type>` un enfant de ce que nomme
l'enregistrement, jamais de la boucle du relais, et appose son propre *span* sur ce qui part, si
bien que les consommateurs sont ses enfants. Un tour qui ne trouve rien à publier ne crée aucun
*span*, et il n'y a pas de *span* par tour.

![Une seule trace à travers deux chaînes d'appels. Dans la requête HTTP, le span POST /appointments contient la commande, qui contient, à travers les spans unit-of-work, domain-event et handler, outbox append ; outbox append appose son propre traceparent sur l'événement, et l'outbox le stocke avec l'enregistrement. Plus tard, le relais réclame l'enregistrement depuis un minuteur, sans span à lui ; tracedPublisher ouvre publish comme enfant du span que nomme l'enregistrement, et appose son propre traceparent sur le message, dans l'enveloppe et dans un en-tête. Chaque consommateur ouvre process comme enfant de publish. L'identifiant de trace est le même de la requête HTTP jusqu'aux consommateurs](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/tracing-package-across-the-outbox.fr.svg)

Un événement sans `traceparent` (stocké avant que le traçage soit configuré) poursuit plutôt le
*span* actif.

**Poursuivre ou lier.** Les conventions de messagerie d'OpenTelemetry permettent à un
consommateur de poursuivre la trace du producteur ou d'en démarrer une nouvelle qui la référence
par un lien. Par défaut, il poursuit, `traceApplication({ consumers: 'continue' })` : suivre une
action de bout en bout revient alors à ouvrir une seule trace, et Jaeger ne montre un lien que
comme une référence à suivre d'un clic, un consommateur à la fois. Choisissez
`consumers: 'link'` pour un système où un événement se déploie vers tant de consommateurs, ou est
retenté si longtemps, qu'une trace ne finirait jamais : chaque livraison est alors la racine de
sa propre trace, liée à la publication.

![Les deux façons dont un consommateur se rattache à la publication. Avec consumers: continue, le défaut, les spans process des deux consommateurs sont des enfants de publish, dans la trace de la requête HTTP : une action est une trace. Avec consumers: link, publish termine la trace de la requête HTTP, et chaque livraison démarre une trace à elle, dont le span racine process porte un lien vers publish](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/tracing-package-continue-or-link.fr.svg)

**Les livraisons.** Un fournisseur dit à chaque gestionnaire de quelle livraison il s'agit
(`EventDelivery` du noyau : tentative, dernière tentative, transport, source, consommateur), et
chaque tentative est un *span* à part : `app.messaging.attempt` compte à partir de 1,
`app.messaging.redelivered` marque celles qui suivent la première, une tentative en échec est une
erreur avec le code de ce qui a été levé, et la tentative après laquelle le fournisseur abandonne
l'événement dit `app.outcome: dead-lettered`. RabbitMQ, Kafka, NATS, Redis Streams et le bus en
mémoire le disent tous ; leur `traceparent` voyage dans l'enveloppe et dans un vrai en-tête
(`traceparent`).

## Les pièces, sans `kernelModule`

`traceApplication()`, ce sont ces pièces, une par membre, pour une composition écrite à la main :

```ts
bus.use(traceUseCases());                                              // après l'autorisation, hors de l'unité de travail
traceDependency(new KnexOrderRepository(db), { kind: 'repository', context: 'ordering', port: 'OrderRepository' });
tracedDomainEvents(dispatcher);
tracedPublisher(new OutboxPublisher(store));                           // outbox append <type>
tracedPublisher(bus);                                                  // publish <type>
tracedSubscriber(bus, { trace: 'continue' });                          // process <type>
tracedConsumer(handler, { consumer: 'billing.invoice-on-order-placed', context: 'billing' });
tracedJob(run, { name: 'billing.send-reminders', context: 'billing' });
tracedErrorReporter(reporter);
createApplication({ modules, decorate: traceBindings() });             // les liaisons seulement
configureTracing({ executionScope });                                  // identifiant de corrélation sur les spans et dans les champs de journal
```

Les deux dernières lignes sont pour une application dont le module du noyau ne reçoit aucune
`instrumentation`. Avec elle, `traceBindings()` est déjà le membre `binding` que le module du
noyau place autour de chaque liaison, et la portée d'exécution est transmise par le module, si
bien que le *hook* `decorate` n'ajoute rien (envelopper deux fois une instance est sans effet).
Un projet généré par la CLI n'a aucune des deux lignes : il appelle `traceApplication()` une fois
dans `src/platform/lay-foundations.ts`, `tracedRoutes()` dans
`src/platform/auth/authentication/http-boundary.ts`, `tracedPublisher(...)` dans
`src/platform/compose-application.ts`, et `initTracing` dans `src/platform/tracing.ts`. La règle
`tracing/platform-only` garde ces imports dans le répertoire de la plateforme, `main.ts` et
`apps/`.

Un *publisher* nomme lui-même son transport (`messagingSystem` : `rabbitmq`, `kafka`, `nats`,
`redis`, `in-memory`, et `outbox` pour le *publisher* de l'outbox) ; `scopedPublisher` et
`validatingPublisher` le transmettent, et `tracedPublisher(publisher, { system })` le dit pour un
*publisher* à vous.

Pour un transport sur mesure : `captureTraceparent()` au stockage d'un message,
`runWithTraceparent(traceparent, fn)` à son traitement. C'est tout ce que fait l'outbox, et cela
s'exécute tel quel :

<!-- checked sample -->
```ts
import { captureTraceparent, runWithTraceparent, withSpan } from '@ddd-ts-kit/tracing';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';

interface QueuedMessage {
  readonly body: string;
  readonly traceparent: string | undefined;
}

const queue: QueuedMessage[] = [];
const tracing = installTestTracing();

const trace = await tracing.traceOf(async () => {
  // Dans la requête HTTP : stocker le message avec la trace à laquelle il appartient.
  await withSpan('POST /messages', async () => {
    queue.push({ body: 'hello', traceparent: captureTraceparent() });
  });

  // Plus tard, depuis un minuteur, hors de tout span : poursuivre la trace stockée.
  for (const message of queue.splice(0)) {
    await runWithTraceparent(message.traceparent, () => withSpan('handle message', async () => undefined));
  }
});

// Une seule trace : le traitement est un enfant de la requête HTTP, bien qu'elle soit terminée.
expectSpanTree(trace, [{ name: 'POST /messages', children: [{ name: 'handle message' }] }]);
tracing.uninstall();
```

Avec un `traceparent` absent ou malformé, `runWithTraceparent` exécute la fonction dans le
contexte courant. `spanContextFromTraceparent` n'accepte que la version `00` et rejette les
identifiants entièrement nuls. `withSpan(name, fn, attributes?)` existe pour le code de la
plateforme (une migration, une étape de démarrage) ; le code du domaine et de l'application ne
l'appelle jamais.

## Ce que contient un span de dépendance

`traceDependency` ouvre un *span* par appel d'une méthode asynchrone, nommé
`<kind> <Port>.<method>` d'après le port quand il est donné et d'après la classe sinon.
`traceBindings()` l'appelle pour chaque liaison déclarée avec une sorte ; à la main, et vérifié
avec le banc de test :

<!-- checked sample -->
```ts
import { traceDependency, withSpan } from '@ddd-ts-kit/tracing';
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';

// Un adaptateur tel qu'un contexte l'écrit : aucun import du package de traçage.
class InMemoryOrderRepository {
  private readonly rows = new Map<string, number>();

  async save(orderId: string, total: number): Promise<void> {
    this.rows.set(orderId, total);
  }

  async totalOf(orderId: string): Promise<number | undefined> {
    return this.rows.get(orderId);
  }
}

const tracing = installTestTracing();

// La racine de composition l'enveloppe, sous le nom de son port.
const orders = traceDependency(new InMemoryOrderRepository(), {
  kind: 'repository',
  context: 'ordering',
  port: 'OrderRepository',
});

const trace = await tracing.traceOf(() =>
  withSpan('place order', async () => {
    await orders.save('order-1', 3000);
    await orders.totalOf('order-1');
  }),
);

expectSpanTree(trace, [
  {
    name: 'place order',
    children: [
      {
        name: 'repository OrderRepository.save',
        attributes: { 'code.namespace': 'InMemoryOrderRepository', 'code.function': 'save', 'app.context': 'ordering' },
      },
      { name: 'repository OrderRepository.totalOf' },
    ],
  },
]);

console.log(orders instanceof InMemoryOrderRepository); // true : le même objet, enveloppé sur place
tracing.uninstall();
```

Ce que l'enveloppe garde et ce qu'elle laisse de côté :

- Jamais les arguments, les valeurs de retour ni les messages d'erreur ; l'erreur est relancée
  intacte.
- Les méthodes synchrones ne sont pas tracées. Une méthode déclarée `async` est tracée dès son
  premier appel ; une méthode qui se contente de renvoyer une promesse est tracée à partir de son
  deuxième appel. Un appel tracé renvoie une promesse, n'enveloppez donc pas un objet dont les
  méthodes renvoient un constructeur de requêtes chaînable.
- Les accesseurs (getters), les symboles, les générateurs et les *hooks* de cycle de vie
  (`onModuleInit`, `onModuleDestroy`, `onApplicationBootstrap`, `onApplicationShutdown`,
  `dispose`) sont laissés tels quels.
- L'instance est enveloppée sur place : même objet, `instanceof` et `this` intacts, envelopper
  deux fois est sans effet. Rien d'énumérable n'est ajouté, si bien que l'instance se décompose
  (spread) et se compare comme avant.
- `private` est un mot-clé de compilation : à l'exécution, une méthode privée est une méthode, et
  une fonction tenue dans un champ privé est une méthode aussi. Les deux sont tracées quand elles
  sont asynchrones, et une méthode qui en appelle une autre par `this` produit un *span* enfant.
  Les aspects de `@ddd-ts-kit/aspects` diffèrent à dessein : ils n'interviennent que sur l'appel
  fait de l'extérieur.
- Une instance gelée ou scellée est placée derrière un proxy à la place. Ses méthodes et ses
  accesseurs s'exécutent avec la vraie instance comme `this` ; les appels qu'elle fait sur
  elle-même ne sont alors pas tracés.
- **Ordre des enveloppes d'un repository** sous `kernelModule({ instrumentation })`, de la plus
  externe à la plus interne : le *hook* `decorate` de l'application quand il y en a un, le *span*,
  la remise des événements du domaine (`dispatchingOnSave` du noyau), puis les aspects de la
  liaison (`retry`, `timeout`). Ainsi, `repository X.save` couvre les nouvelles tentatives, et un
  enregistrement retenté annonce ses événements une seule fois. Dans une unité de travail,
  `repository X.save` ne contient aucun *span* `domain-event` : l'enregistrement ne fait que mettre
  les événements en file, et ils sont distribués sous `unit-of-work before-commit`, un frère qui
  suit les enregistrements. Hors de toute unité de travail, l'enregistrement distribue avant de se
  résoudre, et les *spans* `domain-event` sont ses enfants.

## Bruit

Une trace raconte l'histoire d'une action et rien d'autre. Les valeurs par défaut, et l'option
pour chacune :

| Quoi | Par défaut | Option |
|---|---|---|
| Sondes, métriques, documentation | aucun *span* pour `/health`, `/healthz`, `/live`, `/livez`, `/ready`, `/readyz`, `/startup`, `/metrics`, `/docs`, `/openapi.json`, `/openapi` (les documents d'un contrat découpé), `/favicon.ico` et ce qui est en dessous ; aucun *span* pour les routes de documentation de `@ddd-ts-kit/http`, où qu'elles soient montées | `initTracing({ ignoredPaths })`, `tracedRoutes({ ignore })` |
| Relais de l'outbox | aucun *span* par tour, aucun quand rien n'est publié ; les requêtes de son interrogation périodique ne créent aucun *span* (voir les pilotes) | |
| Instrumentations actives | `http`, `undici` et `grpc` (les deux côtés d'une requête HTTP), `pg`, `mysql2`, `mysql`, `mongodb`, `ioredis`, `redis` | `initTracing({ autoInstrumentations })`, ou `instrumentations` pour toutes les remplacer |
| Pilotes de base de données | la requête SQL telle qu'écrite, avec ses paramètres substituables, jamais les valeurs qui leur sont liées ; seulement dans une trace (`requireParentSpan`), si bien qu'un processus d'interrogation ou un pool ne crée aucune trace à lui ; aucun *span* de connexion ni d'emprunt au pool (`ignoreConnectSpans`) | `autoInstrumentations` |
| Instrumentations inactives | `fs`, `dns`, `net` (comment un appel a été fait, pas ce qui a été fait) ; `express`, `connect`, `router`, `koa`, `hapi`, `restify`, `nestjs-core` (un *span* par *middleware*, là où le kit nomme la requête HTTP par sa route) ; `amqplib`, `kafkajs` (ils doubleraient `publish` et `process`) ; `knex`, `generic-pool`, `dataloader`, `lru-memoizer`, `mongoose` (ils répètent le pilote) ; les ponts de journalisation, les métriques d'exécution et de l'hôte | `autoInstrumentations: { '@opentelemetry/instrumentation-fs': { enabled: true } }` |
| Attributs | une liste d'autorisation (`DEFAULT_ALLOWED_ATTRIBUTES`) : ce que le kit écrit et ce que les instrumentations actives disent d'une requête HTTP, d'une requête SQL, d'un pair. Les en-têtes, les corps, les valeurs des paramètres, les identifiants d'utilisateur et de client sont retirés avant l'export | `initTracing({ allowedAttributes })`, `new AttributeAllowList({ allowed, alsoAllowed })` |
| Volume | sous une même racine locale (une requête HTTP, une livraison, une exécution de *job*), au plus 25 *spans* de dépendance, d'événement du domaine ou de publication partagent un nom et 200 existent au total ; au-delà, l'appel s'exécute sans trace (un événement publié au-delà du plafond porte quand même la trace plus loin) et `app.dependency_spans.dropped` compte sur la racine | `configureTracing({ maxSpansPerName, maxSpansPerRoot })` |
| Secrets | les valeurs de la chaîne de requête et les informations d'utilisateur (userinfo) des URL enregistrées deviennent `REDACTED` ; les messages d'exception et les piles d'appels sont retirés | |

Les *spans* de cas d'usage, de consommateur, de *job* et de requête HTTP ne sont jamais plafonnés : il
y en a un par unité de travail.

### Échantillonnage

`initTracing({ sampleRatio: 0.2 })` échantillonne une part des traces là où elles commencent, et
un parent échantillonné est toujours suivi : une trace est gardée ou abandonnée en entier, à
travers l'outbox et les contextes, puisque la décision voyage dans le `traceparent` stocké avec
l'événement. Sans l'option, les variables standard `OTEL_TRACES_SAMPLER` s'appliquent, et par
défaut toutes les traces sont gardées.

Garder toutes les traces qui se terminent en erreur, quel que soit le ratio, ne peut pas se
décider au début d'une trace. C'est l'échantillonnage en queue (tail sampling), et il revient à
un collecteur, qui voit les traces entières. Échantillonnez tout dans l'application et décidez
là-bas :

```yaml
# OpenTelemetry Collector (contrib) : entre les applications et Jaeger
receivers:
  otlp: { protocols: { http: { endpoint: 0.0.0.0:4318 } } }
processors:
  tail_sampling:
    decision_wait: 30s
    policies:
      - { name: errors, type: status_code, status_code: { status_codes: [ERROR] } }
      - { name: dead-letters, type: string_attribute, string_attribute: { key: app.outcome, values: [dead-lettered] } }
      - { name: the-rest, type: probabilistic, probabilistic: { sampling_percentage: 10 } }
exporters:
  otlp_http/jaeger: { endpoint: http://jaeger:4318 }
service:
  pipelines:
    traces: { receivers: [otlp], processors: [tail_sampling], exporters: [otlp_http/jaeger] }
```

`decision_wait` doit couvrir le délai du relais de l'outbox et des nouvelles tentatives, sinon
les *spans* tardifs d'une trace sont décidés à part.

## Processeurs de spans

Pour un fournisseur que vous construisez vous-même, ajoutez-les avant le processeur qui exporte :

| Processeur | Effet |
|---|---|
| `LocalRootTracker` | active les plafonds par racine, nomme la corrélation sur la racine locale, et permet à `tracedRoutes()` de reconnaître le *span* d'une instrumentation HTTP |
| `UrlSecretSpanProcessor` | `url.full`, `http.url`, `url.query` : les valeurs de la chaîne de requête et les informations d'utilisateur deviennent `REDACTED`, les noms des paramètres restent |
| `ErrorMessageScrubber` | retire `exception.message`, `exception.stacktrace` et le message de statut enregistré par les instrumentations ; garde `exception.type` |
| `AttributeAllowList` | ne garde que les attributs autorisés |

`initTracing` installe les quatre, puis `extraSpanProcessors`, puis l'exportateur.

## Passer d'un outil à l'autre : trace, journaux, journal d'audit, suivi des erreurs

Chaque *span* qui démarre une unité de travail (le *span* SERVER, `process <consumer>`,
`job <name>`) porte `app.correlation_id` et `app.origin` : l'identifiant de corrélation du kit, le
même dans chaque contexte délimité qu'une action atteint. À partir de là :

```ts
const logger = pino({ mixin: () => traceLogFields() });
// dans une unité de travail : { correlationId, origin, actorId, tenantId?, causationId?, trace_id, span_id }
```

| De | Vers | Par |
|---|---|---|
| une trace | ses lignes de journal | `trace_id` des champs de journal, ou `correlationId` |
| une trace | les entrées d'audit de l'action | `app.correlation_id` est le `correlationId` de l'`AuditEntry` |
| un rapport d'erreur | sa trace | `traceId` de l'`ErrorReport`, rempli par `tracedErrorReporter` (aussi pour un *job* en échec ou un événement enterré, signalés une fois leurs *spans* terminés) |
| une ligne de journal, une entrée d'audit | la trace | cherchez le tag `app.correlation_id` dans Jaeger |

`traceApplication()` donne la portée d'exécution de l'application à `configureTracing` ; une
composition à la main appelle elle-même `configureTracing({ executionScope })`, et
`traceLogFields(scope)` prend la portée en argument pour un *logger* construit plus tôt.
`correlationIdFromActiveSpan()` renvoie l'identifiant de trace, utilisable comme référence de
support quand le projet n'a pas de portée d'exécution. **Rien de personnel ne devient un
attribut de span** : l'acteur et le *tenant* restent dans les champs de journal, dont la durée de
conservation vous appartient.

## Vérifier les traces dans un projet

```ts
import { expectSpanTree, installTestTracing } from '@ddd-ts-kit/tracing/testing';

const tracing = installTestTracing();          // un vrai fournisseur qui garde les spans terminés ; uninstall() à la fin

it('books an appointment in one trace', async () => {
  const trace = await tracing.traceOf(() => app.resolve(CommandBus).execute(new BookAppointment('09:00')));

  expectSpanTree(trace, [
    {
      name: 'command BookAppointment',
      attributes: { 'app.context': 'scheduling', 'app.outcome': 'succeeded' },
      children: [
        { name: 'repository AppointmentRepository.findOverlapping' },
        { name: 'repository AppointmentRepository.save' },
        { name: 'unit-of-work before-commit', children: [{ name: 'domain-event scheduling.appointment.booked' }] },
      ],
    },
  ]);
});
```

- `traceOf(action)` renvoie les *spans* terminés pendant l'action sous forme de données simples
  (`SpanNode` : nom, sorte, statut, attributs, identifiants de trace et de *span*, liens, enfants
  dans l'ordre de leur démarrage) : un arbre par racine, donc deux traces font deux arbres.
- `expectSpanTree(actual, expected)` est exact sur les noms et la structure : un *span* qui n'est
  pas listé fait échouer, tout comme un *span* listé qui manque. Les sortes, les statuts et les
  attributs sont vérifiés quand ils sont donnés (`undefined` attend l'absence d'un attribut), et
  un *span* est attendu sans erreur sauf si `status: 'ERROR'` le dit. En cas d'écart, l'erreur
  liste ce qui diffère, puis montre les deux arbres sous forme de texte indenté. Il ne dépend
  d'aucun lanceur de tests.
- `installTestTracing({ processors, sampler })` prend les processeurs du projet et un
  échantillonneur, pour vérifier le nettoyage ou l'échantillonnage.

## Tests

```
npx vitest run packages/tracing
DDD_TS_KIT_TEST_JAEGER_IMAGE=jaegertracing/jaeger:2.22.0 npx vitest run packages/tracing/test/jaeger
```

La seconde commande a besoin de Docker : elle démarre son propre Jaeger (un conteneur nommé
`ddd-ts-kit-test-trace-jaeger-<pid>`, sur deux ports libres de la boucle locale), exécute le
scénario ci-dessus avec `initTracing({ serviceName })` et la variable standard du point d'accès,
relit la trace par l'API HTTP de Jaeger et vérifie le même arbre, puis supprime le conteneur.
