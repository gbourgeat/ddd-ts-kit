[English](sagas-and-process-managers.md) · **Français**
<!-- translation-of: sagas-and-process-managers.md sha256:ee53642dbd845965 -->

# Sagas et gestionnaires de processus

**Résumé.** Un processus métier qui s'étend sur plusieurs agrégats ou plusieurs contextes ne
peut pas être une seule transaction dans cette architecture. La saga est l'alternative : une
suite de transactions locales, chacune annoncée par un événement, avec une action de
compensation pour chaque étape qu'il faudra peut-être défaire. Elle peut être chorégraphiée
(chaque contexte réagit aux événements des autres) ou orchestrée (un composant, un gestionnaire
de processus, décide de l'étape suivante). Le kit fournit les briques (événements d'intégration,
outbox transactionnelle, consommateurs idempotents, *jobs* planifiés et *jobs* en arrière-plan)
et un petit moteur d'exécution pour les gestionnaires de processus : un processus est une classe
dont les étapes décident à partir de son état et de ce qui s'est passé, et un *runner* conserve
son état avec une concurrence optimiste et livre ses délais d'expiration sous forme de *jobs* en
arrière-plan différés. Ce n'est pas un moteur de *workflow*.

## Pourquoi une saga

Supposons que le produit ajoute un acompte : un rendez-vous avec certains praticiens n'est
confirmé qu'une fois l'acompte payé, et le créneau est libéré si le paiement n'arrive pas dans
les quinze minutes. Trois contextes sont concernés (`appointments`, un contexte ou un fournisseur
de paiement, `notifications`), et la règle « un agrégat par transaction, aucune transaction entre
contextes » ([ARCHITECTURE.fr.md](../ARCHITECTURE.fr.md), section 4) interdit de le faire en une
seule validation (commit).

Le processus devient une suite d'étapes :

![Le processus d'acompte sous forme d'états : BookAppointment laisse le rendez-vous en attente de son acompte ; l'acompte payé le confirme ; l'acompte refusé, ou quinze minutes écoulées, l'annule. Chaque flèche est une transaction locale dans un seul contexte](../assets/diagrams/sagas-and-process-managers-deposit-states.fr.svg)

Chaque flèche est une transaction locale dans un seul contexte. Entre deux flèches, le système
est dans un état intermédiaire visible (« en attente d'acompte »), que le produit doit nommer
(voir [Cohérence à terme](eventual-consistency.fr.md)).

## Compensation

Une saga n'a pas d'annulation (rollback). Une étape déjà validée se défait par une autre action
métier :

| Étape | Compensation |
|---|---|
| retenir le créneau | libérer le créneau (annuler le rendez-vous en attente) |
| encaisser l'acompte | rembourser l'acompte |
| envoyer la confirmation | envoyer un avis d'annulation (un message ne se « désenvoie » pas) |

Les compensations font partie du domaine : « annuler avec le motif deposit-not-received » est une
méthode d'intention de `Appointment`, avec son propre événement. Certaines étapes ne peuvent pas
être compensées (un SMS, un colis parti) ; ordonnez le processus de sorte qu'elles viennent en
dernier (Garcia-Molina et Salem ; Richardson appelle la dernière de ces étapes le pivot).

## Chorégraphie ou orchestration

| | Chorégraphie | Orchestration |
|---|---|---|
| Qui décide de l'étape suivante | chaque contexte, en réagissant aux événements | un gestionnaire de processus, en envoyant des commandes |
| Où le processus est visible | nulle part en un seul endroit : il est la somme des abonnements | dans le gestionnaire de processus |
| Couplage | les contextes connaissent les événements les uns des autres | l'orchestrateur connaît chaque participant ; les participants ne connaissent que leurs commandes |
| Ajouter une étape | un nouvel abonné ; les autres ne changent pas | une modification de l'orchestrateur |
| Délais d'expiration et « chaque étape a-t-elle eu lieu ? » | malaisé : personne n'est responsable de la question | naturel : l'orchestrateur détient l'état |
| Convient à | des flux courts et linéaires de deux ou trois étapes | des flux avec des branches, des délais d'expiration, des compensations |
| Risque | des dépendances cycliques entre événements, un processus que personne ne sait décrire | un composant central qui accumule de la logique métier |

![Deux façons d'exécuter le flux d'acompte. Chorégraphie : appointments, payments et notifications réagissent aux événements les uns des autres, et le processus est la somme de leurs abonnements. Orchestration : un gestionnaire de processus dans appointments réagit aux événements et à son délai d'expiration, conserve l'état du processus et envoie les commandes de son propre contexte ; payments est atteint par ses événements et par un port de gateway](../assets/diagrams/sagas-and-process-managers-choreography-orchestration.fr.svg)

Dans l'application de planification, « envoyer un rappel quand un rendez-vous est réservé » est
de la chorégraphie et n'a besoin de rien de plus : `notifications` consomme
`appointments.appointment.booked`. Le flux d'acompte, avec son délai d'expiration et ses deux
issues, mérite un responsable.

## Ce que le kit fournit, et ce qu'il ne fournit pas

Fourni :

- **les événements d'intégration**, déclarés dans un langage publié, avec des versions ;
- **l'outbox transactionnelle**, pour que l'événement de chaque étape existe si et seulement si
  l'étape a été validée ;
- **des consommateurs idempotents**, avec un stockage des événements traités dans la transaction
  du consommateur, pour qu'un événement livré de nouveau n'exécute pas une étape deux fois ;
- **l'identifiant de corrélation et l'identifiant de causalité**, portés par le contexte
  d'exécution et apposés sur les événements publiés, pour retrouver chaque étape d'un même
  processus dans les journaux, les traces et le journal d'audit ;
- **les gestionnaires de processus** : `ProcessManager`, `ProcessRunner` et `ProcessStore` dans
  le noyau (kernel), le *runner* dans `@ddd-ts-kit/scheduling`, les stockages dans les *packages*
  d'ORM, `givenProcess` dans `@ddd-ts-kit/testing` (plus bas) ;
- **les délais d'expiration**, sous forme de [*jobs* en arrière-plan](background-jobs.fr.md) mis
  en file avec un délai, dans la transaction de l'étape qui les arme ; **les *jobs* planifiés**
  pour le travail qui se déduit de l'état ;
- **les files de rejet (dead letters) et la remontée des erreurs** pour une étape qui échoue
  définitivement.

Non fourni :

- aucun moteur de *workflow*, aucun DSL, aucun concepteur visuel, aucune tâche humaine ;
- aucune compensation automatique : défaire est une commande que décide le processus ;
- aucune commande envoyée à un autre contexte : un contexte ne fait que réagir à des événements
  ou répondre à travers un port de *gateway*, si bien qu'un processus vit dans le contexte dont
  il envoie les commandes ;
- aucun ordre des événements d'une même instance au-delà de ce que donne le transport : une étape
  décide à partir de l'état qu'elle trouve, et la concurrence optimiste départage deux étapes
  simultanées.

Un projet qui a besoin de *workflows* longs et très ramifiés, avec des minuteries durables et des
étapes humaines, devrait regarder du côté d'un moteur de *workflow* dédié derrière un port
(Temporal, Camunda et des produits semblables existent ; ils n'ont pas été évalués pour ce kit
et rien ici ne les intègre).

## Un gestionnaire de processus

L'exemple de planification en a un : l'échéance de confirmation d'un rendez-vous demandé. Elle
est armée quand le rendez-vous est demandé, désarmée quand il est confirmé, annulé ou expiré, et
quand l'échéance passe la première, elle fait expirer le rendez-vous à cet instant précis.

<!-- checked sample -->
```ts
// scheduling/application/processes/confirmation-deadline.process.ts
import {
  AuthorizedCommand,
  systemActor,
  type Actor,
  type DomainEvent,
  type ProcessDecision,
  type ProcessManager,
} from '@ddd-ts-kit/kernel';

// Déclarés ici pour que l'exemple compile seul ; dans l'exemple, ce sont des fichiers du contexte.
declare class AppointmentBooked implements DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly held: { readonly confirmBefore?: Date };
}
declare class ExpireUnconfirmedAppointmentsCommand extends AuthorizedCommand {
  constructor(actor: Actor, at: Date);
}

/** L'état de l'échéance d'un rendez-vous demandé : du JSON simple, l'échéance est donc un texte ISO. */
export interface ConfirmationDeadlineState {
  readonly appointmentId: string;
  readonly confirmBefore: string;
}

/** L'unique délai d'expiration du processus. */
const DEADLINE = 'deadline';

export class ConfirmationDeadlineProcess implements ProcessManager<ConfirmationDeadlineState> {
  static readonly processName = 'scheduling.confirmation-deadline';

  static readonly timeoutJob = 'scheduling.confirmation-deadline-timeout';

  /** Reconnaît un état que cette version a sauvegardé : un état écrit par une autre version est refusé, pas mal lu. */
  static isState(value: unknown): value is ConfirmationDeadlineState {
    return typeof value === 'object' && value !== null && 'appointmentId' in value && 'confirmBefore' in value;
  }

  /** Demandé avec une échéance : armer le délai. Réservé d'emblée, ou déjà armé : rien à décider. */
  requested(
    event: AppointmentBooked,
    current: ConfirmationDeadlineState | undefined,
  ): ProcessDecision<ConfirmationDeadlineState> | undefined {
    const { confirmBefore } = event.held;

    if (current !== undefined || confirmBefore === undefined) {
      return undefined;
    }

    return {
      state: { appointmentId: event.aggregateId, confirmBefore: confirmBefore.toISOString() },
      timeouts: [{ name: DEADLINE, at: confirmBefore }],
    };
  }

  /** Confirmé, annulé ou expiré à temps : désarmer l'échéance et terminer. */
  settled(current: ConfirmationDeadlineState | undefined): ProcessDecision<ConfirmationDeadlineState> | undefined {
    return current === undefined ? undefined : { state: current, cancel: [DEADLINE], ended: true };
  }

  /** L'échéance est passée la première : faire expirer le rendez-vous, au nom du processus lui-même. */
  timedOut(name: string, current: ConfirmationDeadlineState): ProcessDecision<ConfirmationDeadlineState> | undefined {
    if (name !== DEADLINE) {
      return undefined;
    }

    const actor = systemActor(ConfirmationDeadlineProcess.processName);

    return {
      state: current,
      ended: true,
      commands: [new ExpireUnconfirmedAppointmentsCommand(actor, new Date(current.confirmBefore))],
    };
  }
}
```

- **Une étape est une fonction de l'état et de ce qui s'est passé.** Elle répond par une
  `ProcessDecision` : l'état suivant (du JSON simple), les commandes à envoyer, les délais
  d'expiration à armer ou à désarmer, si le processus s'est terminé ; ou `undefined` pour ignorer
  l'événement. Elle ne détient aucun *repository* et n'écrit aucun agrégat : ce sont les
  commandes qui le font (`process/sends-commands-only`).
- **Corrélation.** Une instance est désignée par le processus et par une clé de corrélation que
  porte l'événement : le gestionnaire (handler) qui reçoit un événement donne cette clé au
  *runner* (`event.aggregateId`, `event.payload.orderId`), et le *runner* charge l'instance, ou
  aucune quand elle n'existe pas.
- **Le *runner*** (`ProcessRunner`) exécute une étape dans une seule unité de travail : charger,
  décider, désarmer et armer les délais d'expiration, sauvegarder avec une concurrence
  optimiste, envoyer les commandes. Deux étapes qui décident sur la même version : l'une gagne,
  l'autre échoue avec une `ConcurrencyError`. Pour une étape appelée par un gestionnaire
  d'événement d'intégration, la nouvelle livraison de son événement la réexécute sur le nouvel
  état ; pour une étape appelée par un gestionnaire d'événement du domaine, dans l'unité de
  travail de la commande qui a levé l'événement, la commande échoue et son appelant la retente.
  Une instance terminée ignore tout événement ultérieur. Un délai d'expiration désarmé ou armé
  par une étape dont la transaction est annulée (rollback) reste tel qu'il était, dans chaque
  stockage de la file.
- **Câblage.** Les étapes sont appelées par les gestionnaires du contexte : des gestionnaires
  d'événements du domaine pour ses propres événements, des gestionnaires d'événements
  d'intégration pour ceux des contextes amont, chacun appelant
  `processes.run(Process, key, (current) => process.step(event, current))`. Un délai
  d'expiration est un *job* en arrière-plan du contexte, nommé par le membre statique
  `timeoutJob`, qui appelle `processes.timeout(Process, { ...due, jobId: execution.jobId }, ...)` :
  le *runner* ne l'exécute que tant que ce *job* précis est celui qui est armé, si bien qu'un
  délai désarmé ou remplacé ne se déclenche jamais.
- **Stockages.** `InMemoryProcessStore` (noyau) pour les tests et pour un seul processus ;
  `KnexProcessStore` et `createProcessTable`, `DrizzleProcessStore` et `processesTable`,
  `PrismaProcessStore` et le modèle `ProcessInstance`, `TypeOrmProcessStore` et `processEntity`, qui sauvegardent dans la transaction de l'étape. Chaque stockage est tenu par
  `processStoreContract`. Avec l'`ExecutionScope` pour `tenant`, chacun des quatre garde une
  instance dans le tenant du travail qui l'enregistre, sous une clé qui comprend le tenant : deux
  tenants peuvent utiliser la même clé de corrélation, et aucun ne trouve ni ne modifie l'instance
  de l'autre. Un projet généré avec `--tenancy` le lui donne.

Les deux classes qui appellent les étapes, dans l'exemple : le gestionnaire d'un événement du
domaine du contexte, exécuté dans l'unité de travail de la commande qui a réservé, et le *job* en
arrière-plan qui livre le délai d'expiration.

<!-- checked sample -->
```ts
import {
  ProcessRunner,
  processTimeoutDuePayload,
  type BackgroundJob,
  type BackgroundJobExecution,
  type DomainEvent,
  type ProcessDecision,
  type ProcessTimeoutDue,
} from '@ddd-ts-kit/kernel';
import { Background, DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

// Déclarés ici pour que l'exemple compile seul : l'événement et le processus montrés plus haut.
interface ConfirmationDeadlineState {
  readonly appointmentId: string;
  readonly confirmBefore: string;
}
declare class AppointmentBooked implements DomainEvent {
  static readonly eventName: 'scheduling.appointment.booked';
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}
type Decision = ProcessDecision<ConfirmationDeadlineState> | undefined;
declare class ConfirmationDeadlineProcess {
  static readonly processName: string;
  static readonly timeoutJob: string;
  static isState(value: unknown): value is ConfirmationDeadlineState;
  requested(event: AppointmentBooked, current: ConfirmationDeadlineState | undefined): Decision;
  timedOut(name: string, current: ConfirmationDeadlineState): Decision;
}

/** L'étape de l'échéance d'un rendez-vous réservé, dans l'unité de travail qui l'a réservé. */
@DomainEventHandler(AppointmentBooked)
export class ConfirmationDeadlineOnBookedEventHandler implements DomainEventHandler<AppointmentBooked> {
  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async handle(event: AppointmentBooked): Promise<void> {
    // La clé de corrélation : une instance du processus par rendez-vous.
    await this.processes.run(ConfirmationDeadlineProcess, event.aggregateId, (current) =>
      this.process.requested(event, current),
    );
  }
}

/** Un délai livré trois fois sans succès est mort : le job d'expiration expire quand même le rendez-vous. */
const MAX_ATTEMPTS = 3;

/** Livre les délais d'expiration du processus, chacun à son échéance. Son jobName est le timeoutJob du processus. */
@Background({ maxAttempts: MAX_ATTEMPTS })
export class ConfirmationDeadlineTimeoutBackgroundJob implements BackgroundJob<ProcessTimeoutDue> {
  static readonly jobName = 'scheduling.confirmation-deadline-timeout';

  static readonly payload = processTimeoutDuePayload;

  private readonly process = new ConfirmationDeadlineProcess();

  constructor(private readonly processes: ProcessRunner) {}

  async run(due: ProcessTimeoutDue, execution: BackgroundJobExecution): Promise<void> {
    // Le runner n'exécute l'étape que tant que ce job précis est celui qui est armé.
    await this.processes.timeout(ConfirmationDeadlineProcess, { ...due, jobId: execution.jobId }, (current) =>
      this.process.timedOut(due.timeout, current),
    );
  }
}
```

![Le runner à l'œuvre : le gestionnaire de AppointmentBooked appelle run ; le runner ne charge aucune instance, met en file le job du délai pour l'échéance et sauvegarde la version 1, dans l'unité de travail de la réservation. À l'échéance, sauf si une étape l'a désarmé, le job du délai appelle timeout avec son identifiant de job ; le runner charge l'instance, vérifie que ce job est celui qui est armé, sauvegarde la version 2, terminée, puis envoie ExpireUnconfirmedAppointments](../assets/diagrams/sagas-and-process-managers-runner-sequence.fr.svg)

## Tests

Une étape se teste sans stockage, sans file et sans bus :

<!-- checked sample -->
```ts
import { givenProcess } from '@ddd-ts-kit/testing';
import type { ProcessDecision } from '@ddd-ts-kit/kernel';
import { describe, it } from 'vitest';

// Déclarés ici pour que l'exemple compile seul : le processus montré plus haut et un événement de la spec.
interface ConfirmationDeadlineState {
  readonly appointmentId: string;
  readonly confirmBefore: string;
}
interface AppointmentBooked {
  readonly aggregateId: string;
  readonly held: { readonly confirmBefore?: Date };
}
type Decision = ProcessDecision<ConfirmationDeadlineState> | undefined;
declare const process: {
  requested(event: AppointmentBooked, current: ConfirmationDeadlineState | undefined): Decision;
  settled(current: ConfirmationDeadlineState | undefined): Decision;
};
declare const booked: AppointmentBooked; // appointment-1, demandé, à confirmer avant l'échéance

const deadline = new Date('2026-03-01T12:00:00.000Z');
const watching: ConfirmationDeadlineState = { appointmentId: 'appointment-1', confirmBefore: deadline.toISOString() };

describe('The confirmation deadline of an appointment', () => {
  it('is armed when the appointment is requested, for its deadline', () => {
    givenProcess<ConfirmationDeadlineState>(undefined)
      .when((current) => process.requested(booked, current))
      .thenState(watching)
      .thenTimeouts([{ name: 'deadline', at: deadline }])
      .thenCommands([]);
  });

  it('is disarmed and ended once the appointment is confirmed in time', () => {
    givenProcess(watching)
      .when((current) => process.settled(current))
      .thenCancelled(['deadline'])
      .thenEnded();
  });
});
```

`thenIgnored`, `thenState`, `thenCommands` (par classe ou par les propriétés qui comptent),
`thenTimeouts`, `thenCancelled` et `thenEnded` s'enchaînent. L'application de test exécute tout
le chemin : son `ProcessRunner` est en mémoire, `app.processes.list()` montre les instances et
`app.backgroundJobs.runDue()` livre les délais d'expiration échus selon son horloge.

`ddd-ts-kit generate process <context> <Name>` en démarre un : le processus avec une première
étape qui arme une échéance, une étape qui le termine à temps et l'étape de l'échéance, le *job*
en arrière-plan qui livre ses délais d'expiration, et les *specs* des deux, écrites avec
`givenProcess` et à travers la file de l'application de test sur tsyringe, une file et un
*runner* en mémoire sur les bus de test sinon. Les étapes auxquelles il doit réagir sont ensuite
appelées par des gestionnaires d'événements (`generate event-handler`) via `ProcessRunner.run`.
Le *runner* est lié par le module noyau de `@ddd-ts-kit/di` sur tsyringe et construit par
`src/platform/jobs/create-background-work.ts` là où la plateforme est câblée à la main
(`platform.processes`) ; `stack.queue` dit où les instances sont conservées.

## Sans moteur d'exécution : un agrégat porte le processus

Un processus qui appartient à un seul agrégat est souvent l'agrégat lui-même : `Appointment`
peut porter `pending-deposit`, ses méthodes étant les transitions (voir
[Machines à états](state-machines.fr.md)), chaque étape une commande déclenchée par un
événement. Une échéance est alors une donnée de l'agrégat, et un *job* planifié envoie « annuler
les rendez-vous dont l'acompte est en retard », déduit de l'état et sans risque à répéter.
Tournez-vous vers un gestionnaire de processus quand le processus s'étend sur plusieurs
agrégats, a son propre état, ou a besoin de délais d'expiration précis.

**Les courses sont départagées par la concurrence.** « Acompte payé » et « échéance passée »
peuvent arriver ensemble. Sur un agrégat, la concurrence optimiste laisse l'un gagner, et l'autre
est refusé ou retenté ; sur un processus, la version de son instance fait de même.

## Limites et quand ne pas l'utiliser

- **Demandez-vous d'abord si la frontière est mauvaise.** Un cas d'usage qui doit modifier deux
  contextes en une seule transaction est le premier signal que la *skill* `bounded-contexts`
  cite pour une frontière mal placée. Une saga est la réponse quand les contextes sont séparés à
  juste titre, pas une façon de vivre avec un mauvais découpage.
- **Les états intermédiaires sont visibles.** Les autres utilisateurs voient le créneau retenu
  pendant que l'acompte est en attente. Les sagas n'ont pas d'isolation : concevez les états au
  lieu de les cacher.
- **La compensation n'est pas toujours possible**, et elle est elle-même une étape qui peut
  échouer et doit être retentée.
- **Ce moteur d'exécution ne passe pas à l'échelle des *workflows* complexes.** Au-delà d'une
  poignée d'étapes, de branches parallèles ou de tâches humaines, cette gestion de l'état et des
  délais est ce pour quoi les moteurs de *workflow* existent.
- **Les délais d'expiration sont aussi précis que le *worker*** : un *job* différé s'exécute une
  fois échu et pris en charge, jusqu'à un intervalle de scrutation de sa file plus tard ; un délai
  déduit par un *job* planifié est aussi grossier que son intervalle. Une échéance qui doit tenir
  à la seconde près a besoin des deux : le délai d'expiration, et un *job* planifié comme filet
  de sécurité.
- **Au moins une fois.** Une étape peut s'exécuter deux fois (un événement livré de nouveau, un
  délai dont le *worker* est mort) : la décision se déduit de l'état, et les commandes sont sans
  risque à répéter.
- **La chorégraphie peut créer des cycles.** Si `appointments` consommait des événements de
  `notifications` pendant que `notifications` consomme `appointments`, les relations déclarées
  formeraient un cycle, que `context/no-cycle` refuse. Le propriétaire du processus doit être en
  amont, ou la réponse doit passer par un contexte qui l'est.
- **Tester une saga de bout en bout est lent.** Testez chaque transition sur l'agrégat, chaque
  gestionnaire avec des *fakes*, et un seul chemin de bout en bout.

## Sources

- Hector Garcia-Molina et Kenneth Salem, « Sagas », ACM SIGMOD 1987.
- Chris Richardson, Microservices Patterns, Manning, 2018, chapitre 4 (« Managing transactions
  with sagas ») ; https://microservices.io/patterns/data/saga.html
- Gregor Hohpe et Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003 (Process
  Manager, Routing Slip, Correlation Identifier).
- Sam Newman, Building Microservices, 2e édition, O'Reilly, 2021, chapitre 6 (« Workflow » :
  sagas orchestrées et chorégraphiées).
- Vaughn Vernon, Implementing Domain-Driven Design, Addison-Wesley, 2013, chapitre 4
  (« Long-Running Processes »).
- Vlad Khononov, Learning Domain-Driven Design, O'Reilly, 2021, chapitre 9 (saga et gestionnaire
  de processus).
- Pat Helland, « Life beyond Distributed Transactions: an Apostate's Opinion », CIDR 2007.

## Voir aussi

- [Agrégats](aggregates.fr.md)
- [Cohérence à terme](eventual-consistency.fr.md)
- [Événements du domaine et d'intégration](domain-and-integration-events.fr.md)
- [Outbox transactionnelle](transactional-outbox.fr.md)
- [Livraison et idempotence](delivery-and-idempotency.fr.md)
- [Jobs planifiés](scheduled-jobs.fr.md)
- [Jobs en arrière-plan](background-jobs.fr.md)
- [Machines à états](state-machines.fr.md)
- [Contexte délimité](bounded-context.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
