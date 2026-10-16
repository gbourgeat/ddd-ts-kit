[English](domain-and-integration-events.md) · **Français**
<!-- translation-of: domain-and-integration-events.md sha256:0c008806fa400428 -->

# Événements du domaine et événements d'intégration

**Résumé.** Un événement affirme que quelque chose s'est produit, au passé. Ce kit distingue
deux sortes d'événements faciles à confondre. Un événement du domaine est un fait interne à un
contexte délimité (bounded context), enregistré par un agrégat et traité dans le même contexte.
Un événement d'intégration est un contrat entre contextes, déclaré une seule fois dans le langage
publié du producteur avec une version et un schéma, et livré au moins une fois. Un *publisher*
de la couche application traduit le premier en le second. Les garder séparés, c'est ce qui permet
à un modèle de changer sans casser ses consommateurs.

## Deux sortes, côte à côte

| | Événement du domaine | Événement d'intégration |
|---|---|---|
| Public | le contexte qui l'a levé | d'autres contextes, éventuellement d'autres services |
| Déclaré dans | `domain/events/`, une classe | `published-language/`, avec `defineIntegrationEvent({ type, version, payload })` |
| Forme | ce que le modèle trouve commode ; peut contenir des objets-valeurs | du JSON simple dans une enveloppe versionnée, validé par un schéma |
| Stabilité | change librement avec le modèle | un contrat : additif à l'intérieur d'une version, sinon une nouvelle version |
| Levé par | l'agrégat, quand son état change | un *publisher* qui réagit à un événement du domaine |
| Livraison | dans le processus, à la fin de l'unité de travail de la commande : avant sa validation (commit) par défaut, après elle pour un gestionnaire déclaré `after-commit` | au moins une fois, par l'outbox quand il y a une base de données, jamais pour une commande annulée |
| Traité par | `application/event-handlers/` | `application/integration/handlers/` du contexte consommateur |
| Les consommateurs doivent être | des gestionnaires (handlers) ordinaires | idempotents, enregistrés sous un nom de consommateur stable |
| Documenté dans | le code | le catalogue des événements et le document AsyncAPI générés |

Les deux suivent le format de nom `<context>.<aggregate>.<fact>` (`events/name-format`), c'est
pourquoi la même chaîne, `scheduling.appointment.booked`, peut nommer l'événement du domaine et
l'événement d'intégration construit à partir de lui. Ce sont pourtant deux déclarations avec deux
cycles de vie.

Côte à côte, dans le contexte `scheduling` de l'application d'exemple. L'événement du domaine est
une classe du domaine, libre de contenir une `Date` ou un objet-valeur :

```ts
import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

// contexts/scheduling/domain/events/appointment-booked.event.ts (simplifié)
export class AppointmentBooked extends NamedDomainEvent('scheduling.appointment.booked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly slot: Slot, // un type du modèle, que les consommateurs ne voient jamais
  ) {
    super();
  }
}
```

L'événement d'intégration est une déclaration du langage publié : un type, une version et un
schéma de JSON simple, qui valide ce qui est publié et ce qui est consommé :

```ts
// contexts/scheduling/published-language/appointment-booked.v1.integration-event.ts (simplifié)
export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.booked',
  version: 1,
  payload: zodSchema(z.object({ appointmentId: z.string(), startsAt: z.string().datetime() /* ... */ })),
});
```

La déclaration complète est dans [Concevoir la charge utile](#concevoir-la-charge-utile).

## Le chemin d'un fait

![Le chemin d'un fait : dans le contexte scheduling, le gestionnaire de commande réserve un Appointment, qui enregistre AppointmentBooked ; le save met l'événement en file ; une fois le gestionnaire terminé, le publisher le transforme en ligne d'outbox dans la même transaction ; après le commit de la transaction, le relais le livre, au moins une fois, au gestionnaire d'événement d'intégration du contexte notification, qui envoie une commande de son propre contexte](../assets/diagrams/domain-and-integration-events-path.fr.svg)

1. **L'agrégat enregistre.** `Appointment.book(...)` vérifie les invariants et enregistre
   l'événement du domaine. Un agrégat ne publie jamais rien lui-même et ne connaît aucun bus.

   <!-- checked sample -->
   ```ts
   // contexts/scheduling/domain/aggregates/appointment.aggregate.ts (simplifié)
   import { AggregateRoot, ConceptError, type DomainEvent } from '@ddd-ts-kit/kernel';

   interface Slot {
     readonly calendarId: string;
     readonly practitionerId: string;
     readonly patientId: string;
     readonly startsAt: Date;
     readonly endsAt: Date;
   }

   export class AppointmentBooked implements DomainEvent {
     static readonly eventName = 'scheduling.appointment.booked';

     readonly name = AppointmentBooked.eventName;

     constructor(
       readonly aggregateId: string,
       readonly occurredAt: Date,
       readonly slot: Slot,
     ) {}
   }

   export class AppointmentError extends ConceptError {
     static emptySlot(startsAt: Date) {
       return AppointmentError.refusal('EMPTY_SLOT', 'A slot ends after it starts.', { startsAt });
     }
   }

   export class Appointment extends AggregateRoot {
     private constructor(
       id: string,
       readonly slot: Slot,
     ) {
       super(id);
     }

     static book(id: string, slot: Slot, now: Date): Appointment {
       if (slot.endsAt <= slot.startsAt) {
         throw AppointmentError.emptySlot(slot.startsAt); // l'invariant d'abord
       }

       const appointment = new Appointment(id, slot);
       appointment.record(new AppointmentBooked(id, now, slot)); // enregistré, pas publié

       return appointment;
     }
   }
   ```

2. **Le `save` remet les événements, l'unité de travail les distribue.** `save` ne fait que
   mettre en file les événements enregistrés. Une fois que le gestionnaire de commande a rendu la
   main, ils sont distribués aux gestionnaires du même contexte, dans la transaction de la
   commande, avant sa validation. Le gestionnaire de commande écrit
   `await this.appointments.save(appointment)` et rien d'autre : ni `pullEvents()`, ni
   distributeur (`domain-events/dispatched-on-save`, [ARCHITECTURE.fr.md](../ARCHITECTURE.fr.md)
   section 4, « Événements du domaine »).

   Au lieu de remettre les événements à la main :

   ```ts
   await this.appointments.save(appointment);
   await this.dispatcher.dispatch(appointment.pullEvents()); // refusé : domain-events/dispatched-on-save
   ```

   écrivez le `save` seul :

   <!-- checked sample -->
   ```ts
   // contexts/scheduling/application/commands/book-appointment/book-appointment.handler.ts (simplifié)
   import { AggregateRoot, Clock, Command, IdGenerator, Repository } from '@ddd-ts-kit/kernel';
   import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

   interface Slot {
     readonly calendarId: string;
     readonly practitionerId: string;
     readonly patientId: string;
     readonly startsAt: Date;
     readonly endsAt: Date;
   }

   declare class Appointment extends AggregateRoot {
     static book(id: string, slot: Slot, now: Date): Appointment;
   }

   export abstract class AppointmentRepository extends Repository<Appointment> {}

   export class BookAppointmentCommand extends Command<string> {
     constructor(readonly slot: Slot) {
       super();
     }
   }

   @CommandHandler(BookAppointmentCommand)
   export class BookAppointmentHandler implements CommandHandler<BookAppointmentCommand> {
     constructor(
       private readonly appointments: AppointmentRepository,
       private readonly ids: IdGenerator,
       private readonly clock: Clock,
     ) {}

     async execute(command: BookAppointmentCommand): Promise<string> {
       const appointment = Appointment.book(this.ids.next(), command.slot, this.clock.now());

       await this.appointments.save(appointment); // les événements enregistrés partent avec le save

       return appointment.id;
     }
   }
   ```

3. **Un *publisher* traduit.** L'un de ces gestionnaires est le *publisher* : il construit
   l'événement d'intégration à partir de l'événement du domaine et le remet au port
   `IntegrationEventPublisher`. Avec une base de données, ce port est l'outbox, si bien que
   l'événement est stocké dans la transaction de la commande (`events/outbox-required`, voir
   [Outbox transactionnelle](transactional-outbox.fr.md)). Le relais le publie après le
   commit de la transaction, jamais pour une commande annulée.

   <!-- checked sample -->
   ```ts
   // contexts/scheduling/application/integration/publishers/appointment-booked.publisher.ts (simplifié)
   import { IdGenerator, IntegrationEventPublisher, type DomainEvent } from '@ddd-ts-kit/kernel';
   import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
   import type { IntegrationEventDefinition } from '@ddd-ts-kit/events';

   interface Slot {
     readonly calendarId: string;
     readonly practitionerId: string;
     readonly patientId: string;
     readonly startsAt: Date;
     readonly endsAt: Date;
   }

   class AppointmentBooked implements DomainEvent {
     static readonly eventName = 'scheduling.appointment.booked';

     readonly name = AppointmentBooked.eventName;

     constructor(
       readonly aggregateId: string,
       readonly occurredAt: Date,
       readonly slot: Slot,
     ) {}
   }

   interface AppointmentBookedV1Payload {
     readonly appointmentId: string;
     readonly practitionerId: string;
     readonly patientId: string;
     readonly startsAt: string;
     readonly endsAt: string;
   }

   // la déclaration du langage publié, montrée dans « Concevoir la charge utile »
   declare const appointmentBookedV1: IntegrationEventDefinition<AppointmentBookedV1Payload>;

   @DomainEventHandler(AppointmentBooked)
   export class AppointmentBookedPublisher implements DomainEventHandler<AppointmentBooked> {
     constructor(
       private readonly publisher: IntegrationEventPublisher,
       private readonly ids: IdGenerator,
     ) {}

     async handle(event: AppointmentBooked): Promise<void> {
       // le modèle est traduit champ par champ : une Date devient un texte ISO 8601
       const published = appointmentBookedV1.create(
         {
           appointmentId: event.aggregateId,
           practitionerId: event.slot.practitionerId,
           patientId: event.slot.patientId,
           startsAt: event.slot.startsAt.toISOString(),
           endsAt: event.slot.endsAt.toISOString(),
         },
         { id: this.ids.next(), occurredAt: event.occurredAt },
       );

       await this.publisher.publish([published]); // l'outbox, dans la transaction de la commande
     }
   }
   ```

4. **Le consommateur réagit.** Dans `notification`, un gestionnaire d'événement d'intégration
   traduit l'événement en une commande de son propre contexte et l'envoie sur le bus de
   commandes. Il ne contient aucune logique métier et n'importe que le langage publié de l'amont.
   Son nom de consommateur est stable : il délimite l'idempotence du gestionnaire et nomme
   l'acteur système sous lequel il s'exécute.

   <!-- checked sample -->
   ```ts
   // contexts/notification/application/integration/handlers/scheduling-appointment-booked.integration-handler.ts (simplifié)
   import { AuthorizedCommand, CommandBus, systemActor, type Actor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
   import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
   import type { IntegrationEventDefinition } from '@ddd-ts-kit/events';

   interface AppointmentBookedV1Payload {
     readonly appointmentId: string;
     readonly patientId: string;
     readonly startsAt: string;
   }

   // importé du langage publié de scheduling, la seule chose que notification en connaît
   declare const appointmentBookedV1: IntegrationEventDefinition<AppointmentBookedV1Payload>;

   export class SendNotificationCommand extends AuthorizedCommand {
     constructor(
       actor: Actor,
       readonly notice: { readonly recipientId: string; readonly appointmentId: string; readonly startsAt: Date },
     ) {
       super(actor);
     }
   }

   @IntegrationEventHandler(appointmentBookedV1, { consumer: 'notification.scheduling-appointment-booked' })
   export class SchedulingAppointmentBookedIntegrationHandler {
     readonly actor = systemActor('notification.scheduling-appointment-booked');

     constructor(private readonly commands: CommandBus) {}

     async handle(event: IntegrationEvent<AppointmentBookedV1Payload>): Promise<void> {
       const { patientId, appointmentId, startsAt } = event.payload;

       await this.commands.execute(
         new SendNotificationCommand(this.actor, { recipientId: patientId, appointmentId, startsAt: new Date(startsAt) }),
       );
     }
   }
   ```

Le *publisher* est la soupape anti-fuite : l'événement du domaine peut gagner un champ, être
scindé ou renommé, et l'événement d'intégration reste ce qu'il était jusqu'à ce que l'équipe
décide de le versionner.

## Quand un événement du domaine est traité

**Un effet d'un événement du domaine n'existe que si le changement d'état qui l'a enregistré est
validé.** Un gestionnaire `before-commit` est validé avec lui, un gestionnaire `after-commit`
ne s'exécute qu'après lui, un événement d'intégration n'est publié qu'après lui.

Une commande, deux `save` :

![La chronologie d'une commande : dans une transaction, le gestionnaire de commande enregistre a et b, leurs événements attendent dans une file, les gestionnaires before-commit s'exécutent une fois qu'il a rendu la main et le publisher écrit la ligne d'outbox, puis tout est validé ensemble ; après la validation, les gestionnaires after-commit s'exécutent sur les mêmes événements avant que la commande réponde ; plus tard, le relais publie la ligne d'outbox, au moins une fois](../assets/diagrams/domain-and-integration-events-unit-of-work.fr.svg)

Dans une unité de travail, un `save` ne fait que mettre en file les événements que ses agrégats
ont enregistrés, dans l'ordre d'enregistrement, tous `save` confondus. Quand le gestionnaire de
commande a rendu la main, toujours dans la transaction, la file est distribuée. Un gestionnaire
peut enregistrer un agrégat : ses événements rejoignent la file derrière ceux qui attendent,
selon la même règle d'ordre, sans récursion. Un gestionnaire peut ajouter une ligne à l'outbox.
Puis la transaction est validée, et les gestionnaires de la phase `after-commit` s'exécutent.

| | Garanties | Quand il échoue | Livraison |
|---|---|---|---|
| gestionnaire `before-commit` (par défaut) | s'exécute une fois tous les `save` de la commande faits (quand le gestionnaire de commande a rendu la main), dans sa transaction ; ce qu'il écrit est validé ou annulé avec le changement d'état | la commande échoue et tout est annulé | dans la transaction : exactement avec la validation |
| gestionnaire `after-commit` | s'exécute une fois la transaction validée, jamais quand elle a été annulée, dans l'ordre de distribution, attendu avant que la commande réponde | la commande réussit quand même ; l'échec est journalisé et remonté, les autres gestionnaires s'exécutent quand même | au plus une fois |
| événement d'intégration | ajouté à l'outbox par un *publisher* `before-commit`, publié par le relais après le commit de la transaction, jamais pour une commande annulée | le relais réessaie ; les consommateurs sont idempotents | au moins une fois |

### Les deux phases

`before-commit` est la phase par défaut. `after-commit` se déclare sur le gestionnaire :

<!-- checked sample -->
```ts
// un gestionnaire after-commit, pour l'illustration
import { NamedDomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

class AppointmentBooked extends NamedDomainEvent('scheduling.appointment.booked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

/** Un tableau des créneaux libres gardé dans un cache : le rafraîchir peut échouer sans dommage. */
export abstract class AvailabilityBoard {
  abstract refresh(appointmentId: string): Promise<void>;
}

@DomainEventHandler(AppointmentBooked, { phase: 'after-commit' })
export class AppointmentBookedEventHandler implements DomainEventHandler<AppointmentBooked> {
  constructor(private readonly board: AvailabilityBoard) {}

  async handle(event: AppointmentBooked): Promise<void> {
    await this.board.refresh(event.aggregateId);
  }
}
```

Dans le style explicite, la phase est donnée à l'enregistrement :
`dispatcher.on(AppointmentBooked.eventName, callback, { phase: 'after-commit' })`.
Le générateur écrit l'un ou l'autre : `npx ddd-ts-kit generate event-handler scheduling Appointment
Booked --phase after-commit`.

**Voyez l'ordre par vous-même.** Les parties en mémoire du kernel suivent les mêmes règles que
les adaptateurs des ORM, si bien que quelques lignes montrent quand chaque phase s'exécute.
`unitOfWorkStage()` indique à un gestionnaire où il en est :

<!-- checked sample -->
```ts
import { NamedDomainEvent, 
  AggregateRoot,
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  Repository,
  dispatchingOnSave,
  unitOfWorkStage,
  type DomainEvent,
} from '@ddd-ts-kit/kernel';

class SlotHeld extends NamedDomainEvent('scheduling.slot.held') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

class Slot extends AggregateRoot {
  static hold(id: string, now: Date): Slot {
    const slot = new Slot(id);
    slot.record(new SlotHeld(id, now));

    return slot;
  }
}

class InMemorySlotRepository implements Repository<Slot> {
  private readonly rows = new Map<string, Slot>();

  async findById(id: string): Promise<Slot | undefined> {
    return this.rows.get(id);
  }

  async save(slot: Slot): Promise<void> {
    this.rows.set(slot.id, slot); // persiste seulement : aucun code de distribution dans un adaptateur
  }
}

const dispatcher = new InMemoryDomainEventDispatcher();
const slots = dispatchingOnSave(new InMemorySlotRepository(), () => dispatcher); // ce que fait le conteneur
const unitOfWork = new InMemoryUnitOfWork();
const seen: string[] = [];

dispatcher.on(SlotHeld.eventName, async (event) => {
  seen.push(`before-commit ${event.aggregateId} (${unitOfWorkStage()})`);
});
dispatcher.on(
  SlotHeld.eventName,
  async (event) => {
    seen.push(`after-commit ${event.aggregateId} (${unitOfWorkStage()})`);
  },
  { phase: 'after-commit' },
);

const now = new Date('2026-03-09T10:00:00Z');

await unitOfWork.run(async () => {
  await slots.save(Slot.hold('a', now));
  await slots.save(Slot.hold('b', now));
  seen.push(`the command handler returns (${unitOfWorkStage()})`);
});

// seen contient maintenant :
//   the command handler returns (open)
//   before-commit a (before-commit)
//   before-commit b (before-commit)
//   after-commit a (after-commit)
//   after-commit b (after-commit)
```

Rien n'atteint un gestionnaire pendant que le travail s'exécute : les deux `save` sont faits
avant que le premier gestionnaire `before-commit` entende parler de l'un ou de l'autre.

**Ce qui est au plus une fois.** La phase `after-commit`, et elle seule. Un arrêt brutal entre la
validation et l'exécution perd l'effet, et un gestionnaire qui échoue n'est pas relancé. Son
échec ne peut pas faire échouer la commande : il est journalisé (`Logger.error`, « A domain
event handler failed after the commit », avec `domainEvent`, `errorType`, `errorCode`) et remis
à l'`ErrorReporter` sous l'opération `after-commit <event name>`. Tout ce qui doit être fiable
passe par l'outbox, sous forme d'événement d'intégration.

**Un gestionnaire `after-commit` n'enregistre jamais.** Remettre un agrégat à un *repository* à
cet endroit (`save`, `saveAll`, `remove(aggregate)`) est refusé avant l'écriture par
`SaveAfterCommitError` : l'unité de travail est terminée, donc rien ne distribuerait les
événements de cet agrégat ni n'annulerait l'écriture. Un tel gestionnaire envoie une commande
par le `CommandBus`, qui ouvre une unité de travail à elle. `unitOfWorkStage()` du kernel répond
`'outside'`, `'open'`, `'before-commit'` ou `'after-commit'`.

Au lieu d'enregistrer dans le gestionnaire :

```ts
// un gestionnaire after-commit de AppointmentCancelled
const waitlist = await this.waitlists.findById(event.calendarId);
waitlist.offer(event.slot, this.clock.now());
await this.waitlists.save(waitlist); // SaveAfterCommitError : l'unité de travail est terminée
```

envoyez une commande, dont la propre unité de travail enregistre, distribue et valide :

```ts
const freed = { startsAt: event.slot.startsAt, endsAt: event.slot.endsAt, heldUntil: event.slot.heldUntil };
await this.commands.execute(new OfferFreedSlotCommand(this.actor, event.calendarId, freed));
```

### Pourquoi un gestionnaire before-commit n'a que des effets transactionnels

La validation elle-même peut échouer après l'exécution des gestionnaires `before-commit` : une
contrainte différée, un échec de sérialisation, une connexion perdue. Tout ce qu'ils ont écrit
dans la transaction disparaît avec elle, ligne d'outbox comprise. Un effet hors de la base de
données, lui, resterait. La garantie n'est donc sûre que parce qu'un gestionnaire `before-commit`
ne peut avoir que des effets transactionnels, ce que tient `domain-events/transactional-before-commit`.
Un tel gestionnaire peut dépendre :

- des ports de *repository* et de la couche domaine de son contexte ;
- des ports du kernel autres que `Cache`, `CachePurger`, `Lock`, `RateLimiter`, `JobScheduler` et `EventBus`
  (`CacheInvalidation` en est un : la purge qu'il demande est validée avec le travail, voir
  [Cache HTTP](http-caching.fr.md)) ;
- des ports de `application/ports/` dont les adaptateurs sont tous sous `infrastructure/persistence/`.

Une *gateway*, un port externe ou un adaptateur de `infrastructure/external/` demande un choix :

![Où va la réaction à un événement du domaine : un autre contexte réagit, publier un événement d'intégration ; l'effet n'écrit que dans la transaction, un gestionnaire before-commit ; l'effet peut être perdu, un gestionnaire after-commit ; sinon, derrière un événement d'intégration, par l'outbox](../assets/diagrams/domain-and-integration-events-where-a-reaction-goes.fr.svg)

| L'effet | Va |
|---|---|
| peut être perdu (un cache à rafraîchir, une notification sans garantie) | dans un gestionnaire avec `phase: 'after-commit'` |
| ne doit pas être perdu | derrière un événement d'intégration : outbox, au moins une fois |

Un gestionnaire `after-commit` ne dépend pas de `IntegrationEventPublisher` : la transaction qui
contiendrait la ligne d'outbox est terminée.

### Ce qu'un échec laisse derrière lui

| Ce qui échoue | Résultat |
|---|---|
| un `save` | il ne retire rien : ses événements restent sur l'agrégat et n'atteignent aucun gestionnaire ; l'unité de travail est annulée, les événements des `save` précédents sont abandonnés |
| le gestionnaire de commande, après un `save` | les événements en file sont abandonnés : aucun gestionnaire d'aucune phase ne s'exécute |
| un gestionnaire `before-commit` | la commande échoue avec ce qu'il a levé ; annulation ; les événements encore en attente sont abandonnés ; aucun gestionnaire `after-commit` ne s'exécute |
| la validation | annulation ; aucun gestionnaire `after-commit` ne s'exécute, aucune ligne d'outbox n'existe |
| un gestionnaire `after-commit` | rien n'est défait : l'état est validé et la commande réussit |

Les événements retirés par un `save` d'une unité de travail annulée sont abandonnés et jamais
remis sur l'instance de l'agrégat. Une nouvelle tentative (retry) exécute à nouveau la commande sur
des agrégats rechargés, qui enregistrent à nouveau leurs événements ; ceux-ci sont distribués une
seule fois. Une instance d'agrégat d'une commande qui a échoué n'est pas réutilisée.

### Où vit la file

La file appartient à une portée ouverte par `withinUnitOfWork(work, transaction)` du kernel,
dans un `AsyncLocalStorage`. Chaque `UnitOfWork.run` du kit est construit dessus
(`InMemoryUnitOfWork`, drizzle, knex, prisma, typeorm), si bien qu'un `run` appelé directement
par un consommateur ou un script a le même déroulé qu'une commande. `unitOfWorkMiddleware`
l'appelle aussi : une commande est couverte même avec une `UnitOfWork` propre au projet qui ne le
fait pas.

- Un `run` imbriqué, ou une commande envoyée depuis une unité de travail par un gestionnaire,
  rejoint la portée en cours : une seule distribution, à la fin de la plus externe, et la phase
  `after-commit` après la validation de la plus externe.
- Deux commandes concurrentes ne partagent jamais une portée.
- Un projet qui écrit sa propre `UnitOfWork` construit `run` dessus, et exécute
  `unitOfWorkContract` de `@ddd-ts-kit/testing/contracts`, qui fait échouer un adaptateur qui
  l'aurait oublié :

<!-- checked sample -->
```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { withinUnitOfWork, type UnitOfWork } from '@ddd-ts-kit/kernel';

/** Le pilote du projet : commence, appelle, valide quand le travail est résolu, annule quand il est rejeté. */
interface Ledger {
  transaction<T>(work: (transaction: LedgerTransaction) => Promise<T>): Promise<T>;
}

interface LedgerTransaction {
  readonly id: string;
}

export class LedgerUnitOfWork implements UnitOfWork {
  private readonly current = new AsyncLocalStorage<LedgerTransaction>();

  constructor(private readonly ledger: Ledger) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return withinUnitOfWork(work, (scoped) => {
      if (this.current.getStore() !== undefined) {
        return scoped(); // un run imbriqué rejoint la transaction en cours
      }

      return this.ledger.transaction((transaction) => this.current.run(transaction, scoped));
    });
  }
}
```

`transaction` commence, appelle ce qu'on lui donne, valide quand c'est résolu et annule quand
c'est rejeté. `withinUnitOfWork` fait le reste.

Le contrat est exécuté par les quatre *packages* d'ORM sur PGlite, dans le processus. Les
*packages* knex, prisma et typeorm l'exécutent aussi sur un vrai PostgreSQL quand
`DDD_TS_KIT_TEST_DATABASE_URL` est défini ; il y prouve en plus que les lignes d'un gestionnaire
`before-commit` sont invisibles depuis une autre connexion et visibles des gestionnaires
`after-commit`. La validation qui échoue est une contrainte différée.

### En dehors de toute unité de travail

Dans un test du domaine, avec un *repository* utilisé seul, dans un script, il n'y a rien à
attendre : le `save` distribue avant de se résoudre, les gestionnaires `before-commit` puis les
`after-commit`. Rien n'est atomique alors : un gestionnaire qui échoue fait rejeter le `save`
sans le défaire.

### Ce qui a changé

Auparavant, les événements d'un agrégat étaient distribués juste après chaque `save`, dans la
transaction. Ce qu'il faut vérifier lors de la mise à jour :

| Si le projet a | Faites |
|---|---|
| un gestionnaire qui comptait s'exécuter entre deux `save` d'une commande | il s'exécute maintenant après les deux : lisez l'état dont il a besoin dans ce qui est enregistré, ou scindez la commande |
| un gestionnaire avec un effet hors de la base de données (une *gateway*, un cache, un appel distant) | déclarez-le `phase: 'after-commit'`, ou placez le travail derrière un événement d'intégration quand il ne doit pas être perdu ; `domain-events/transactional-before-commit` le signale |
| sa propre `UnitOfWork` | construisez `run` sur `withinUnitOfWork` et exécutez `unitOfWorkContract` |
| son propre `DomainEventDispatcher` | `dispatch(events, phase?)` et `on(name, handler, { phase }?)` : respectez la phase, et ne rejetez jamais dans la phase `after-commit` |
| un gestionnaire d'événement du domaine qui envoie une commande | envoyée avant la validation, la commande rejoint l'unité de travail en cours : ses événements sont distribués avec les autres, pas avant qu'elle rende la main. Envoyée après la validation, elle ouvre une unité de travail à elle |
| un appel à `apartFromDomainEventFlow` | retiré de `@ddd-ts-kit/kernel`, sans remplacement : voir la ligne ci-dessus |
| une *spec* construite sur `createTestBuses()` | `commandBus` exécute les commandes dans son unité de travail : les gestionnaires sont entendus une fois que le gestionnaire de commande a rendu la main |
| des assertions ou des tableaux de bord sur des arbres de *spans* | les *spans* `domain-event` ne sont plus sous `repository X.save` : voir le README de [`@ddd-ts-kit/tracing`](../../packages/tracing/README.fr.md) |

## Pourquoi ne pas publier directement l'événement du domaine

Il est tentant de remettre `AppointmentBooked` à chaque contexte intéressé. Trois choses tournent
mal :

- **Le modèle devient une API publique.** Renommer un objet-valeur de `scheduling` casse
  `analytics`. L'amont ne peut plus refactoriser.
- **Des faits internes fuient.** `scheduling` peut enregistrer des événements fins qui lui sont
  utiles (un créneau a été retenu, une retenue a expiré). Les consommateurs n'en ont pas besoin et
  ne devraient pas bâtir dessus.
- **Le contrat de livraison diffère.** Un événement du domaine est traité dans le processus, à la
  fin de l'unité de travail de la commande. Un événement d'intégration peut traverser un *broker*,
  arriver deux fois, arriver en retard. Mélanger les deux masque les garanties sur lesquelles un
  gestionnaire peut compter.

Tout événement du domaine ne devient pas un événement d'intégration. Publiez ce à quoi un autre
contexte a une raison de réagir, quand l'un d'eux le demande.

## Concevoir la charge utile

La charge utile (payload) est ce dont les consommateurs ont besoin pour agir sans rappeler le
producteur, et rien d'interne (la *skill* `integration-event` donne la même règle).

<!-- checked sample -->
```ts
// contexts/scheduling/published-language/appointment-booked.v1.integration-event.ts (simplifié)
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.booked',
  version: 1,
  description: 'A patient booked an appointment with a practitioner.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string().describe('Identifier of the appointment.'),
      practitionerId: z.string(),
      patientId: z.string(),
      startsAt: z.string().datetime().describe('Start of the slot, ISO 8601, UTC.'),
      endsAt: z.string().datetime(),
    }),
  ),
});

/** Ce qu'un consommateur lit, dérivé du schéma : pas de second type à garder en phase. */
export type AppointmentBookedV1Payload = PayloadOf<typeof appointmentBookedV1>;
```

L'application d'exemple déclare le même événement avec class-validator
(`classSchema(AppointmentBookedV1Payload)`) ; tout schéma de `@ddd-ts-kit/validation` convient.

| Question | Conseil |
|---|---|
| Des identifiants ou des données ? | Les identifiants plus les faits qui définissent l'événement (le créneau). `notification` peut planifier un rappel à partir de `startsAt` sans interroger `scheduling` |
| L'agrégat entier ? | Non. Un vidage de l'agrégat couple les consommateurs au modèle et grossit avec lui |
| Des données personnelles ? | Seulement quand un consommateur en a besoin. Un *broker* conserve les messages ; l'enveloppe ne porte aucun acteur par défaut pour la même raison (README des événements) |
| Un fait ou une instruction ? | Un fait. `scheduling.appointment.booked`, pas « send-reminder » : le producteur ne sait pas ce que font les consommateurs |
| Des consommateurs sensibles à l'ordre ? | Placez une version ou une séquence de l'agrégat dans la charge utile : l'ordre n'est pas garanti par défaut (voir [Livraison et idempotence](delivery-and-idempotency.fr.md)) |
| Descriptions des champs | Écrites dans le schéma : elles passent dans le catalogue et dans le document AsyncAPI |

Il existe un vrai compromis entre les événements maigres (identifiants seuls, les consommateurs
rappellent le producteur) et les événements riches (assez d'état pour agir). Les événements
maigres gardent le contrat petit, mais font de chaque consommateur un client synchrone du
producteur. La règle du kit penche vers « assez pour agir », parce que rappeler le producteur
défait l'autonomie que l'événement devait apporter.

## Ce que fournit le kit

- `defineIntegrationEvent` donne le type de la charge utile, valide ce qui est publié et ce qui
  est consommé, et alimente le catalogue et le document AsyncAPI générés
  (`events/defined-in-published-language`).
- L'enveloppe est standard : identifiant, type, version, instant de survenue, charge utile,
  contexte de trace, identifiant de corrélation, et le *tenant* auquel appartient le fait quand il
  y en a un.
- Le fournisseur est derrière deux ports du kernel, un *publisher* et un abonné ; le bus en
  mémoire est celui par défaut, et les *brokers* sont des adaptateurs tenus par une même suite de
  contrat (voir [Brokers de messages](../tools/message-brokers.fr.md)).
- Les générateurs écrivent la déclaration, le *publisher*, le gestionnaire, leurs *specs* et leur
  enregistrement.

## Limites, et quand ne pas l'utiliser

- **Deux déclarations pour un fait, c'est une duplication voulue.** Dans un contexte avec un seul
  consommateur et un modèle stable, cela paraît lourd. C'est pourtant la frontière qui permet aux
  deux d'évoluer séparément.
- **Les événements sont le mauvais outil pour une question.** Un contexte qui ne peut décider
  sans une réponse immédiate a besoin d'un port *gateway*, pas d'une requête déguisée en
  événement suivie d'un événement de réponse.
- **Les événements sont le mauvais outil à l'intérieur de la transaction d'un agrégat.** Deux
  choses qui doivent changer ensemble appartiennent à un seul agrégat ; un événement les rend
  cohérentes à terme (voir [Cohérence à terme](eventual-consistency.fr.md)).
- **Un gestionnaire d'événement du domaine s'exécute par défaut dans la transaction de la
  commande.** S'il échoue, la commande échoue et le changement d'état est annulé. Un effet local
  qui ne doit pas bloquer la commande est un gestionnaire `after-commit`, et peut être perdu ;
  une réaction qui ne doit pas être perdue passe par l'outbox, sous forme d'événement
  d'intégration.
- **Le kit ne stocke pas les événements du domaine d'un agrégat persisté par état.** Ils sont
  distribués avec le `save`, puis disparaissent. Un agrégat choisi pour l'*event sourcing* garde
  ses événements comme son flux : voir [Event sourcing, par agrégat](event-sourcing.fr.md).
- **Les conceptions pilotées par les événements sont plus difficiles à suivre.** Aucun endroit
  unique ne montre tout le flux. Le catalogue généré, la carte des contextes et un diagramme de
  séquence par flux entre contextes dans `docs/integration/README.md` sont la façon dont le kit
  compense.

## Sources

- Eric Evans, Domain-Driven Design Reference, 2015 (Domain Events),
  https://www.domainlanguage.com/ddd/reference/
- Vaughn Vernon, Implementing Domain-Driven Design, Addison-Wesley, 2013, chapitre 8 (« Domain
  Events ») et chapitre 13 (« Integrating Bounded Contexts »).
- Vlad Khononov, Learning Domain-Driven Design, O'Reilly, 2021, chapitre 15 (« Event-Driven
  Architecture » : event notification, event-carried state transfer, domain events).
- Martin Fowler, « What do you mean by Event-Driven? », 2017,
  https://martinfowler.com/articles/201701-event-driven.html
- Gregor Hohpe et Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003 (Event
  Message, Published Language via Canonical Data Model).
- README de [`@ddd-ts-kit/events`](../../packages/events/README.fr.md).

## Voir aussi

- [Briques du domaine](domain-building-blocks.fr.md)
- [Outbox transactionnelle](transactional-outbox.fr.md)
- [Livraison et idempotence](delivery-and-idempotency.fr.md)
- [Versionnement des événements](event-versioning.fr.md)
- [Cohérence à terme](eventual-consistency.fr.md)
- [Carte des contextes](context-map.fr.md)
- [Brokers de messages](../tools/message-brokers.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
