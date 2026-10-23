[English](domain-building-blocks.md) · **Français**
<!-- translation-of: domain-building-blocks.md sha256:4d2290e9600a6cca -->

# Événements du domaine, services du domaine, repositories et fabriques

**Résumé.** Quatre briques complètent les entités, les objets-valeurs et les agrégats. Un
événement du domaine (domain event) est un fait qui intéresse le métier, enregistré par un
agrégat au passé. Un service du domaine (domain service) porte une décision métier qui
n'appartient à aucun agrégat en particulier. Un *repository* donne l'illusion d'une collection
d'agrégats en mémoire, et cache le stockage derrière une abstraction possédée par le domaine.
Une fabrique (factory) construit un agrégat valide quand la construction ne se résume pas à
affecter des champs. Dans ce kit, un *repository* est une classe abstraite du domaine dont les
adaptateurs vivent en infrastructure, un service du domaine est sans état et ne fait aucune
entrée-sortie, les événements du domaine restent à l'intérieur de leur contexte, et les
fabriques sont des méthodes statiques de l'agrégat.

![Le gestionnaire de commande interroge un service du domaine, appelle une intention de l'agrégat, et le charge et le sauvegarde par le port du repository ; l'agrégat enregistre des événements du domaine, distribués aux gestionnaires d'événements du domaine une fois le gestionnaire terminé ; l'adaptateur du repository, en infrastructure, implémente le port](../assets/diagrams/domain-building-blocks-overview.fr.svg)

## Événements du domaine

Un événement du domaine énonce que quelque chose s'est produit : `AppointmentBooked`,
`AppointmentRescheduled`, `AppointmentCancelled`. Il est nommé au passé, il est immuable, et il
porte les faits dont une réaction a besoin, jamais l'agrégat lui-même.

<!-- checked sample -->
```ts
// contexts/appointments/domain/events/appointment-cancelled.event.ts
import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

// un objet-valeur du modèle, venu de domain/value-objects/ : déclaré ici pour que l'exemple se suffise à lui-même
interface CancellationReason {
  readonly by: 'client' | 'practice';
  readonly late: boolean;
}

export class AppointmentCancelled extends NamedDomainEvent('appointments.appointment.cancelled') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly reason: CancellationReason,
  ) {
    super();
  }
}
```

Le nom s'écrit une seule fois, dans `extends NamedDomainEvent('..')` : la classe le porte comme
`eventName` et chaque événement comme `name`, tous deux typés avec le littéral, et chaque réaction
s'y rattache par lui, `@DomainEventHandler(AppointmentCancelled)` le lit sur la classe
qu'il reçoit et `domainEvents.on(AppointmentCancelled.eventName, ..)` le nomme, si bien qu'un
événement renommé ne peut pas laisser un gestionnaire à l'écoute de l'ancien nom.
`events/name-format` en tient la forme, `<context>.<aggregate>.<fact>`, et
`events/name-declared-once` la place : chaque classe de `domain/events/` déclare
son nom une fois, consommée ou non, avec `NamedDomainEvent` ou avec `static readonly eventName`
et un `name` qui le lit. Un événement écrit avant la
0.7, avec `readonly name = '..'` seul, est signalé par cette règle, et `@DomainEventHandler` et
`@On` le refusent à la compilation : étendez `NamedDomainEvent('..')` ou ajoutez `static readonly eventName` à la classe.

L'agrégat enregistre l'événement dans la méthode qui change son état, après l'invariant et le
changement :

<!-- checked sample -->
```ts
// contexts/appointments/domain/aggregates/appointment.aggregate.ts (un extrait)
import { AggregateRoot, DomainRefusal, NamedDomainEvent } from '@ddd-ts-kit/kernel';

class AppointmentCancelled extends NamedDomainEvent('appointments.appointment.cancelled') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly reason: string,
  ) {
    super();
  }
}

// appointments.codes.ts
const AppointmentsCodes = {
  AppointmentAlreadyCancelled: 'APPOINTMENT_ALREADY_CANCELLED',
} as const;

// domain/errors/appointment-already-cancelled.error.ts
class AppointmentAlreadyCancelled extends DomainRefusal {
  readonly code = AppointmentsCodes.AppointmentAlreadyCancelled;

  static forAppointment(appointmentId: string) {
    return AppointmentAlreadyCancelled.refusal(`Appointment ${appointmentId} is already cancelled.`, { appointmentId });
  }
}

export class Appointment extends AggregateRoot<string> {
  private constructor(
    id: string,
    private status: 'booked' | 'cancelled',
  ) {
    super(id);
  }

  cancel(reason: string, at: Date): void {
    if (this.status === 'cancelled') {
      throw AppointmentAlreadyCancelled.forAppointment(this.id); // l'invariant d'abord
    }

    this.status = 'cancelled'; // puis le changement d'état
    this.record(new AppointmentCancelled(this.id, at, reason)); // puis le fait, enregistré, pas publié
  }
}
```

La vie d'un événement du domaine :

![Le gestionnaire appelle cancel sur le rendez-vous, qui enregistre AppointmentCancelled ; la sauvegarde (save) met en file les événements enregistrés ; une fois le gestionnaire terminé, ils sont distribués dans l'ordre d'enregistrement aux gestionnaires d'avant la validation, dans l'unité de travail ; les gestionnaires déclarés after-commit s'exécutent une fois la validation faite](../assets/diagrams/domain-building-blocks-event-life.fr.svg)

- L'**agrégat enregistre** l'événement dans la méthode qui a fait le changement. Il ne publie
  rien : il n'a ni bus ni dépendance.
- Les événements **sont remis par la sauvegarde et distribués à la fin de l'unité de
  travail** : une méthode du *repository* qui reçoit l'agrégat met en file les événements qu'il
  a enregistrés, et une fois le gestionnaire de commande terminé, ils sont distribués dans
  l'ordre d'enregistrement, dans la transaction, avant la validation
  ([ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 4, « Événements du domaine »). Chaque
  gestionnaire voit chaque sauvegarde de la commande. Les gestionnaires et l'outbox sont
  validés ou annulés avec le changement d'état. Un gestionnaire de commande ne fait
  que sauvegarder : il n'appelle jamais `pullEvents()` et ne reçoit aucun distributeur
  (`domain-events/dispatched-on-save`).
- Un gestionnaire s'exécute **avant la validation** par défaut, et ne peut avoir que des effets
  que la transaction couvre. Celui dont l'effet est hors de la base de données se déclare
  `phase: 'after-commit'` : il s'exécute une fois la transaction validée, au plus une fois, et
  ne sauvegarde jamais d'agrégat. Les phases et leurs échecs sont dans
  [Événements du domaine et événements d'intégration](domain-and-integration-events.fr.md).
- Un **gestionnaire d'événement du domaine** (`application/event-handlers/`) réagit à
  l'intérieur du même contexte. Un ***publisher*** (`application/integration/publishers/`) est
  une réaction dont le rôle est de traduire l'événement du domaine en événement d'intégration
  pour les autres contextes.

Deux réactions au même événement, une dans chaque phase :

<!-- checked sample -->
```ts
// contexts/appointments/application/event-handlers/appointment-cancelled.event-handler.ts
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

declare class AppointmentCancelled implements DomainEvent {
  static readonly eventName: 'appointments.appointment.cancelled';
  readonly name: 'appointments.appointment.cancelled';
  readonly aggregateId: string;
  readonly occurredAt: Date;
}

// ports de l'application : ce dont les réactions ont besoin, implémenté en infrastructure
export abstract class Waitlist {
  abstract offerFreedSlot(appointmentId: string): Promise<void>;
}

export abstract class Mailer {
  abstract sendCancellationNotice(appointmentId: string): Promise<void>;
}

// avant la validation (par défaut) : ses écritures sont validées ou annulées avec l'annulation du rendez-vous
@DomainEventHandler(AppointmentCancelled)
export class OfferFreedSlotOnCancellation implements DomainEventHandler<AppointmentCancelled> {
  constructor(private readonly waitlist: Waitlist) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    await this.waitlist.offerFreedSlot(event.aggregateId);
  }
}

// après la validation : un effet qu'aucune transaction ne couvre, exécuté au plus une fois
@DomainEventHandler(AppointmentCancelled, { phase: 'after-commit' })
export class SendCancellationNotice implements DomainEventHandler<AppointmentCancelled> {
  constructor(private readonly mailer: Mailer) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    await this.mailer.sendCancellationNotice(event.aggregateId);
  }
}
```

Un événement du domaine est interne : il peut porter des objets-valeurs du modèle et changer de
forme librement avec lui. Ce qui franchit la frontière d'un contexte est un événement
d'intégration, un contrat versionné doté d'un schéma. La différence, et pourquoi les deux sont
tenus à part, est dans
[Événements du domaine et événements d'intégration](domain-and-integration-events.fr.md).

Les événements sont aussi l'assertion naturelle d'un test du domaine : étant donné un état,
quand une intention, alors ces événements ou cette erreur
([Stratégie de test](testing-strategy.fr.md)).

```bash
npx ddd-ts-kit generate domain-event appointments Appointment Cancelled
npx ddd-ts-kit generate event-handler appointments Appointment Cancelled
```

## Services du domaine

Certaines décisions appartiennent au domaine mais à aucun agrégat en particulier : elles ont
besoin de deux agrégats, ou d'un agrégat et d'une politique qui a ses propres raisons de
changer. Forcer cette logique dans un agrégat le pousse à aller chercher des données qu'il ne
possède pas ; la laisser dans le gestionnaire fait décider à la couche application des
questions métier. Un service du domaine est la troisième place.

<!-- checked sample -->
```ts
// contexts/appointments/domain/services/booking-eligibility.service.ts
import { DomainRefusal } from '@ddd-ts-kit/kernel';

// objets-valeurs et erreurs du modèle, déclarés ici pour que l'exemple se suffise à lui-même
interface TimeSlot {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

interface PractitionerSchedule {
  covers(slot: TimeSlot): boolean;
  isOffDuring(slot: TimeSlot): boolean;
}

// appointments.codes.ts
export const AppointmentsCodes = {
  OutsideWorkingHours: 'OUTSIDE_WORKING_HOURS',
} as const;

// domain/errors/outside-working-hours.error.ts
export class OutsideWorkingHours extends DomainRefusal {
  readonly code = AppointmentsCodes.OutsideWorkingHours;

  static atStart(startsAt: Date) {
    return OutsideWorkingHours.refusal(`The practitioner does not work at ${startsAt.toISOString()}.`, { startsAt });
  }
}

export class BookingEligibilityService {
  assertBookable(slot: TimeSlot, schedule: PractitionerSchedule): void {
    if (!schedule.covers(slot) || schedule.isOffDuring(slot)) {
      throw OutsideWorkingHours.atStart(slot.startsAt);
    }
  }
}
```

`PractitionerSchedule` est ici la projection locale qu'`appointments` garde des heures de
travail et des absences publiées par `calendars` : le gestionnaire la charge par un port et la
transmet. L'application d'exemple en a une plus complète, `SchedulerService`
(`examples/scheduling/src/contexts/scheduling/calendars/domain/services/scheduler.service.ts`) : à partir
d'un calendrier et des rendez-vous déjà pris, elle vérifie le créneau et la limite du patient et
renvoie le nouvel `Appointment`, un service du domaine qui joue le rôle de fabrique.

Plutôt que la même décision dans le gestionnaire :

```ts
// à éviter : l'application décide d'une question métier
const schedule = await this.schedules.of(command.practitionerId);
if (!schedule.covers(slot) || schedule.isOffDuring(slot)) {
  throw OutsideWorkingHours.atStart(slot.startsAt);
}

// à écrire : le gestionnaire charge, le domaine décide
const schedule = await this.schedules.of(command.practitionerId);
this.eligibility.assertBookable(slot, schedule);
```

Les règles d'un service du domaine :

- **Sans état.** Il ne garde aucune donnée entre deux appels.
- **Aucune entrée-sortie.** Il reçoit en paramètres les agrégats et les valeurs qu'il lit ; il
  ne les charge pas. Charger est le travail du gestionnaire, par les *repositories* et les
  ports. La référence le décrit comme « une logique du domaine sans état, portant sur plusieurs
  agrégats ».
- **Nommé dans le langage.** La classe et son opération sont des termes du glossaire
  (`language/glossary-term`) ; `BookingHelper` est refusé (`language/no-technical-name`).
- **Il a une *spec*** (`test/spec-required`), sans double de test : ses entrées sont des objets
  construits.

Ne le confondez pas avec les deux autres choses appelées « service » :

| | Vit dans | Fait |
|---|---|---|
| service du domaine | `domain/services/` | une décision métier sur plusieurs objets du domaine, pure |
| cas d'usage (gestionnaire de commande ou de requête) | `application/` | l'orchestration : charger, appeler le domaine, sauvegarder, publier |
| adaptateur d'un système extérieur | `infrastructure/` | les entrées-sorties derrière un port |

Le kit n'a pas de classe générique de « service applicatif » : un gestionnaire par commande ou
par requête joue ce rôle.

## Repositories

Un *repository* fait paraître les agrégats comme une collection en mémoire : en trouver un, en
sauvegarder un. Le domaine déclare ce dont il a besoin ; l'infrastructure décide comment c'est
stocké.

<!-- checked sample -->
```ts
// contexts/appointments/domain/repositories/appointment.repository.ts
import { AggregateRoot, Repository } from '@ddd-ts-kit/kernel';

declare class Appointment extends AggregateRoot<string> {} // venu de domain/aggregates/

export abstract class AppointmentRepository extends Repository<Appointment> {
  abstract findUpcomingOf(clientId: string, after: Date): Promise<readonly Appointment[]>;
}
```

- **Un port du domaine.** C'est une classe abstraite aux seuls membres abstraits, qui étend le
  `Repository<Aggregate>` du noyau (`findById`, `save`). L'adaptateur de
  `infrastructure/persistence/` l'implémente et ne l'étend jamais
  ([Ports et composition](ports-and-composition.fr.md)).
- **Un par racine d'agrégat.** Chargement et sauvegarde de l'agrégat entier. Aucun
  *repository* pour une entité interne.
- **Les lignes restent à l'intérieur.** Un *mapper* traduit les lignes stockées en agrégat par
  `rehydrate`, et inversement. Aucune entité d'ORM, aucun type de ligne ni constructeur de
  requêtes SQL ne traverse l'interface.
- **Aucune transaction dans la signature.** L'unité de travail est ouverte par l'application
  (un *middleware* de bus le fait pour chaque commande) ; l'adaptateur rejoint la transaction en
  cours et ne valide jamais.
- **Seulement les recherches dont un cas d'usage a besoin**, nommées dans le langage. Les
  requêtes des écrans passent plutôt par un port de lecture, et peuvent se passer entièrement
  des agrégats ([CQRS](cqrs.fr.md)).
- **Un *fake* et un contrat.** Chaque *repository* a un *fake* en mémoire dans `test/fakes/`, et
  le *fake* comme l'adaptateur réel passent la même suite de contrat `repositoryContract`,
  concurrence optimiste comprise.

```bash
npx ddd-ts-kit generate repository appointments Appointment
```

écrit le port, l'adaptateur pour l'ORM du projet avec son *mapper* et sa table, le *fake*, la
*spec* de contrat exécutée sur les deux, et l'inscription.

Un gestionnaire se lit alors comme le cas d'usage :

<!-- checked sample -->
```ts
// contexts/appointments/application/commands/cancel-appointment/cancel-appointment.handler.ts
import { AggregateRoot, AuthorizedCommand, DomainRefusal, Repository, type Actor, type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

// venus du domaine et du fichier de commande du cas d'usage, déclarés ici pour que l'exemple se suffise à lui-même
declare class Appointment extends AggregateRoot<string> {
  cancel(reason: string, at: Date): void;
}
declare abstract class AppointmentRepository extends Repository<Appointment> {}
declare class UnknownAppointment extends DomainRefusal {
  readonly code: 'APPOINTMENT_NOT_FOUND';
  static forAppointment(appointmentId: string): UnknownAppointment;
}
declare class CancelAppointment extends AuthorizedCommand<void> {
  constructor(actor: Actor, appointmentId: string, reason: string);
  readonly appointmentId: string;
  readonly reason: string;
}

@CommandHandler(CancelAppointment)
export class CancelAppointmentHandler implements CommandHandler<CancelAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);
    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(command.appointmentId);
    }

    appointment.cancel(command.reason, this.clock.now());

    await this.appointments.save(appointment);
  }
}
```

Charger, une intention, sauvegarder. Un `if` sur l'état métier dans un gestionnaire a sa place
dans le domaine :

```ts
// à éviter : la règle de l'annulation tardive, dans le gestionnaire
if (appointment.startsAt.getTime() - this.clock.now().getTime() < 24 * 60 * 60 * 1000) {
  appointment.markLateCancellation();
}
appointment.cancel(command.reason, this.clock.now());

// à écrire : une seule intention ; l'agrégat sait ce que « tardive » veut dire
appointment.cancel(command.reason, this.clock.now());
```

Le gestionnaire n'appelle jamais `pullEvents()` et ne publie jamais : la sauvegarde remet les
événements enregistrés, et l'unité de travail les distribue.

## Fabriques

Une fabrique encapsule la création d'un agrégat pour qu'il naisse valide et que l'appelant n'ait
pas à savoir comment. Evans présente les fabriques comme des méthodes ou des objets séparés. Ce
kit retient la forme la plus simple :

| Fabrique | Rôle |
|---|---|
| une méthode statique de naissance sur l'agrégat (`create`, ou un mot du langage comme `Appointment.book`) | vérifie les invariants de naissance, fixe l'état initial, enregistre l'événement de naissance |
| `rehydrate` | restaure un agrégat à partir de l'état stocké, ne vérifie rien, n'enregistre rien ; utilisée par les *mappers* seulement |
| `create` sur un objet-valeur | valide et renvoie la valeur, ou la raison pour laquelle elle est invalide |
| une méthode d'un autre agrégat | quand un agrégat donne naissance à un autre et lui fournit une partie de son état |

Le constructeur est privé, pour que ce soient les seules portes d'entrée :

<!-- checked sample -->
```ts
// contexts/appointments/domain/aggregates/appointment.aggregate.ts (les portes d'entrée)
import { AggregateRoot, DomainRefusal, NamedDomainEvent } from '@ddd-ts-kit/kernel';

class AppointmentBooked extends NamedDomainEvent('appointments.appointment.booked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

// appointments.codes.ts
const AppointmentsCodes = {
  StartsInThePast: 'STARTS_IN_THE_PAST',
} as const;

// domain/errors/starts-in-the-past.error.ts
class StartsInThePast extends DomainRefusal {
  readonly code = AppointmentsCodes.StartsInThePast;

  static atStart(startsAt: Date) {
    return StartsInThePast.refusal(`An appointment cannot start at ${startsAt.toISOString()}, in the past.`, { startsAt });
  }
}

export interface AppointmentState {
  readonly clientId: string;
  readonly startsAt: Date;
  readonly status: 'booked' | 'cancelled';
}

export class Appointment extends AggregateRoot<string> {
  // privé : book et rehydrate sont les seules portes d'entrée
  private constructor(
    id: string,
    private state: AppointmentState,
  ) {
    super(id);
  }

  /** La naissance : vérifie les invariants de naissance, fixe l'état initial, enregistre l'événement de naissance. */
  static book(id: string, wish: { readonly clientId: string; readonly startsAt: Date }, now: Date): Appointment {
    if (wish.startsAt.getTime() <= now.getTime()) {
      throw StartsInThePast.atStart(wish.startsAt);
    }

    const appointment = new Appointment(id, { ...wish, status: 'booked' });
    appointment.record(new AppointmentBooked(id, now));

    return appointment;
  }

  /** Retour du stockage : ne vérifie rien, n'enregistre rien. Appelée par le mapper seulement. */
  static rehydrate(id: string, state: AppointmentState): Appointment {
    return new Appointment(id, state);
  }

  toState(): AppointmentState {
    return { ...this.state };
  }
}
```

Une classe de fabrique séparée est rarement nécessaire ; quand la construction demande des
données de plusieurs sources, le gestionnaire les rassemble et les transmet, ou un service du
domaine les assemble. Les *builders* de données de test sont les fabriques des tests : ils
passent par la même API publique, si bien qu'un test ne peut pas partir d'un état invalide.

## Limites et quand ne pas l'utiliser

- **Les événements du domaine ne sont pas une file de messages.** Ils sont distribués dans le
  processus, par défaut à l'intérieur de la transaction de la commande : une réaction qui échoue
  fait échouer la commande. Une réaction qui doit s'exécuter à part de la commande, ou atteindre
  un autre contexte, passe par un événement d'intégration et
  l'[outbox transactionnelle](transactional-outbox.fr.md).
- **Les événements du domaine ne sont pas de l'*event sourcing*.** Sauf si un agrégat choisit
  l'*event sourcing*, son état est stocké comme un état, et ses événements sont des
  notifications de changements, pas la source de vérité. Un agrégat qui étend
  `EventSourcedAggregate` est l'exception : ses événements sont ce qui est stocké, et son état
  est ce qu'ils donnent une fois additionnés
  ([Event sourcing, par agrégat](event-sourcing.fr.md)).
- **Ne créez pas d'événements auxquels personne ne réagit « au cas où ».** Chacun est un nom à
  maintenir. L'exception est le fait sur lequel porte l'assertion d'un test.
- **Il est facile d'abuser des services du domaine.** Si la plupart des règles vivent dans des
  services et que les agrégats ne font que porter des données, le modèle est anémique
  ([Modèle anémique](anemic-model.fr.md)). Essayez d'abord l'agrégat.
- **Un *repository* n'est pas une API de requêtes.** Ajouter une méthode de recherche par écran
  le transforme en objet d'accès aux données (DAO) et entraîne les préoccupations de lecture
  dans le domaine. Utilisez des ports de lecture.
- **Le kit vérifie des formes, pas des intentions.** Qu'un port de *repository* soit une classe
  abstraite, qu'un gestionnaire ait une seule méthode publique, qu'un fichier de *spec* existe :
  oui. Que le service soit vraiment une décision du domaine et pas de l'orchestration : non, une
  personne qui relit en décide.

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 5 (services) et chapitre 6
  (fabriques, repositories).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitre 7
  « Services », chapitre 8 « Domain Events », chapitre 11 « Factories », chapitre 12
  « Repositories ».
- Martin Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002,
  « Repository », « Unit of Work », « Data Mapper ».
- Martin Fowler, « Domain Event », martinfowler.com/eaaDev/DomainEvent.html.
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapitre 6.

## Voir aussi

- [Agrégats](aggregates.fr.md)
- [Entités et objets-valeurs](entities-and-value-objects.fr.md)
- [Événements du domaine et événements d'intégration](domain-and-integration-events.fr.md)
- [Ports et composition](ports-and-composition.fr.md)
- [CQRS](cqrs.fr.md)
- [Modèle anémique](anemic-model.fr.md)
- [Stratégie de test](testing-strategy.fr.md)
- [Outils de persistance](../tools/persistence.fr.md)
- [Référence de l'architecture](../ARCHITECTURE.fr.md)
- [Index des concepts](README.fr.md)
