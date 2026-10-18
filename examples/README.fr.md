[English](README.md) · **Français**
<!-- translation-of: README.md sha256:7039b42e6383197f -->

# Exemples

[scheduling](scheduling/README.fr.md) est une plateforme de prise de rendez-vous pour des
cabinets, construite avec le kit à partir d'une expression des besoins d'une page : les étapes
stratégiques de la méthode, une seule commande `init`, quatre contextes délimités construits
tranche par tranche par des *workers* en parallèle, une autorisation par relations combinée aux
rôles, une trace par réservation à travers les contextes, et une exécution enregistrée contre
Keycloak, PostgreSQL, Dragonfly, Jaeger et GlitchTip. Il est accompagné d'une mesure honnête du
comportement de l'outillage : [scheduling/docs/tooling-report.fr.md](scheduling/docs/tooling-report.fr.md).
Depuis la racine du dépôt : `npm ci && npm run build && npm run example:verify`.

Cette page est la porte d'entrée : de quoi l'exemple est fait, comment il a été construit, une
requête HTTP suivie à travers son code, et comment le lancer. Le [README de l'exemple](scheduling/README.fr.md)
dit ensuite, notion par notion, quel fichier ouvrir.

## Ce qu'il contient

Une application déployable et un processus *worker*, construits à partir de la même image. Les
deux composent les quatre mêmes contextes délimités ; le processus de l'API sert aussi le HTTP,
relaie l'outbox et tient à jour les projections alimentées par l'*event store*, le
*worker* fait tourner les *jobs* planifiés.

![L'exemple scheduling à l'exécution : le script de démo et les specs appellent l'API directement, Varnish est une façade facultative qui met en cache les lectures publiques (une spec lit à travers lui) et que le relais de l'outbox purge par tag ; le processus de l'API et le processus worker contiennent les quatre mêmes contextes délimités et utilisent Keycloak, PostgreSQL, Dragonfly, Jaeger, GlitchTip et MinIO](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/examples-scheduling-at-a-glance.fr.svg)

| Contexte | Classification | Ce qu'il détient |
|---|---|---|
| `scheduling` | cœur | les calendriers et leurs horaires d'ouverture, jours de changement d'heure compris, les rendez-vous de la réservation à la fin avec une seule occupation par créneau, la liste d'attente, le relevé de présence gardé sous forme de ses événements |
| `identity` | de soutien | les personnes, les cabinets où elles travaillent, leurs rôles là-bas, et ce qu'un praticien a délégué à un assistant |
| `notification` | de soutien | une notification par événement et par destinataire, un rappel 24 heures avant un rendez-vous |
| `analytics` | de soutien | l'issue de chaque rendez-vous ; l'occupation d'un calendrier, mesurée au moment où on la lit |

Un contexte n'importe jamais le modèle d'un autre, seulement son `published-language/` : les
contextes collaborent par des événements d'intégration versionnés,
écrits dans l'outbox dans la transaction du changement et publiés après la validation (commit) : la
[carte des contextes](scheduling/docs/context-map.fr.md) donne le patron de chaque paire, les
[notes d'intégration](scheduling/docs/integration/README.fr.md) les événements. Le journal d'audit
est une capacité de la plateforme, pas un contexte.

## Comment il a été construit

Chaque étape de la méthode a laissé un document : la construction peut donc être lue, et rejouée,
dans l'ordre.

![Comment l'exemple a été construit : l'expression des besoins, la découverte, les contextes délimités, les glossaires et l'ébauche de carte, puis le plan avec la commande init, les tranches, les consignes de cinq workers en parallèle, et la transcription de la démo : une exécution réelle enregistrée après une porte verte](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/examples-how-it-was-built.fr.svg)

| Étape | À lire | Ce qu'il montre |
|---|---|---|
| 1 | [needs.fr.md](scheduling/docs/architecture/needs.fr.md) | la seule entrée : une page écrite par le *product owner* |
| 2 | [discovery.fr.md](scheduling/docs/architecture/discovery.fr.md) | un *event storming* léger, par écrit : acteurs, commandes, événements du domaine, politiques, modèles de lecture |
| 3 | [contexts.fr.md](scheduling/docs/architecture/contexts.fr.md) | les quatre contextes, leur classification, et les découpages rejetés |
| 4 | [before-bootstrap/](scheduling/docs/architecture/before-bootstrap/README.fr.md) | le glossaire et l'ébauche de carte des contextes que l'amorçage a consommés |
| 5 | [plan.fr.md](scheduling/docs/architecture/plan.fr.md) | les décisions prises avec le propriétaire, et la commande `init`, mot pour mot |
| 6 | [slices.fr.md](scheduling/docs/architecture/slices.fr.md) | le *backlog* : les contrats et les squelettes d'abord, puis une ligne par cas d'usage |
| 7 | [briefings/](scheduling/docs/architecture/briefings/README.fr.md) | ce qu'a reçu chacun des cinq *workers* en parallèle |
| 8 | [demo-transcript.fr.md](scheduling/docs/demo-transcript.fr.md) | après une porte verte, une exécution réelle contre les services de l'exemple |

Toute la *stack* est choisie par une seule commande. Voici celle qu'enregistre `plan.md` ; dans ce
dépôt, la CLI est `node ../../packages/cli/dist/bin.js`, lancée depuis `examples/scheduling` :

```bash
npx ddd-ts-kit init --http express --validation class-validator --di tsyringe --style declared \
  --assembly barrel --orm knex --database postgres --events outbox --broker redis --cache redis \
  --authn keycloak --authz rebac --audit on --errors sentry --logger pino --docs-ui swagger \
  --ci both --json
```

Puis un `generate context` par contexte, avec ses termes, et chaque fichier d'une tranche venu du
générateur : le [rapport sur l'outillage](scheduling/docs/tooling-report.fr.md) compte 213
exécutions du générateur réussies et 27 que le générateur a refusées.

## Suivre une requête HTTP à travers le code

La meilleure porte d'entrée dans le code est une requête HTTP. Ici, un patient, ou quelqu'un du
cabinet, annule un rendez-vous : `POST /appointments/:id/cancellation`. En chemin, elle rencontre
trois questions, chacune tranchée à un seul endroit et nulle part ailleurs : qui appelle (le jeton,
en bordure), peut-il faire cela sur ce rendez-vous (l'application, avant que quoi que ce soit ne
change), et est-ce valide tout court (le domaine, qui que soit l'appelant).

![Le chemin d'une annulation : la route laisse passer un appelant authentifié, la permission est vérifiée avant le gestionnaire, la politique dans le gestionnaire avec le rendez-vous chargé, les invariants dans le domaine, puis une unité de travail valide le tout ; chaque vérification répond par son propre refus](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/examples-cancel-three-questions.fr.svg)

**L'application décide qui peut.** La permission est une donnée du contexte ; la commande dit
quelle permission elle exige et sur quel élément ; la règle qui a besoin du rendez-vous chargé est
une politique nommée. Voici le code de l'exemple, raccourci (les déclarations du contexte utilisent
les anciens décorateurs, comme le fait l'exemple) :

<!-- checked sample: legacy-decorators -->
```ts
import { definePermissions, type PolicyContext } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';
import { Policy, Requires } from '@ddd-ts-kit/kernel/declarations';

// Déclarée ici pour que l'extrait compile seul : dans l'exemple, c'est l'agrégat.
declare class Appointment {
  readonly patientId: string;
  readonly slot: { readonly startsAt: Date };
}

// application/authorization/scheduling.permissions.ts
export const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Patient cancels until notice' },
});

// application/commands/cancel-appointment/cancel-appointment.command.ts
@Requires(schedulingPermissions['appointment.cancel'], {
  resource: (command: CancelAppointmentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CancelAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly reason?: string,
  ) {
    super(actor);
  }
}

// application/authorization/patient-cancels-until-notice.policy.ts
const NOTICE_IN_HOURS = 24;
const HOUR = 60 * 60_000;

@Policy(schedulingPermissions['appointment.cancel'], { name: 'scheduling.patient-cancels-until-notice' })
export class PatientCancelsUntilNoticePolicy {
  appliesTo(subject: unknown): subject is Appointment {
    return subject instanceof Appointment;
  }

  allows(actor: Actor, appointment: Appointment, { now }: PolicyContext): boolean {
    if (!isAuthenticated(actor)) {
      return false;
    }

    // Toute autre personne qui détient la permission agit pour le cabinet, à tout moment.
    return actor.id !== appointment.patientId || appointment.slot.startsAt.getTime() - now.getTime() >= NOTICE_IN_HOURS * HOUR;
  }
}
```

Rien ici ne nomme un rôle ni une relation. Qui détient `scheduling:appointment.cancel` sur
`appointment:<id>` est l'affaire de l'autorisateur de la plateforme : la relation `patient` écrite
à la réservation, ou une relation avec le poste (desk) du calendrier (son praticien, un assistant
à qui il a été délégué, un responsable du cabinet)
([ADR 0001](scheduling/docs/adr/0001-combine-token-roles-with-relationships-in-one-authorizer.fr.md)
explique comment les rôles et les relations sont combinés).

**Le gestionnaire demande, le domaine refuse.** Le gestionnaire charge le rendez-vous, interroge
les politiques avec lui, et laisse le reste au domaine : un objet-valeur qui refuse une annulation
par le cabinet sans raison, et un agrégat dont la machine à états refuse de changer un rendez-vous
qui a pris fin.

<!-- checked sample: legacy-decorators -->
```ts
import { Access, definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, DomainRefusal, ValueObject, type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

// Déclarés ici pour que l'extrait compile seul : dans l'exemple, ce sont des fichiers du contexte.
declare class Appointment {
  readonly id: string;
  readonly patientId: string;
  cancel(cancellation: Cancellation, now: Date): void;
}
declare abstract class AppointmentRepository {
  findById(id: string): Promise<Appointment | undefined>;
  save(appointment: Appointment): Promise<void>;
}
declare class CancelAppointmentCommand extends AuthorizedCommand<string> {
  readonly appointmentId: string;
  readonly reason?: string;
}
const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Patient cancels until notice' },
});

// domain/errors/codes.ts : les codes du contexte, le contrat que lit un client ; la plateforme fait correspondre chacun à un statut.
const SchedulingCodes = {
  UnknownAppointment: 'APPOINTMENT_NOT_FOUND',
  ReasonRequired: 'REASON_REQUIRED',
} as const;

// domain/errors/unknown-appointment.error.ts : une classe par refus, nommée d'après ce qui est refusé.
export class UnknownAppointment extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownAppointment;

  static forAppointment(appointmentId: string) {
    return UnknownAppointment.refusal(`Appointment ${appointmentId} does not exist.`, { appointmentId });
  }
}

// domain/errors/reason-required.error.ts
export class ReasonRequired extends DomainRefusal {
  readonly code = SchedulingCodes.ReasonRequired;

  static onCancellation() {
    return ReasonRequired.refusal('The practice gives a reason when it cancels an appointment.');
  }
}

// domain/value-objects/cancellation.vo.ts : l'invariant tient, qui que soit l'appelant.
type CancellationProps = {
  readonly by: 'patient' | 'practice';
  readonly reason: string | undefined;
};

export class Cancellation extends ValueObject<CancellationProps> {
  private constructor(props: CancellationProps) {
    super(props);
  }

  /** Un patient peut annuler sans un mot ; le cabinet dit pourquoi. */
  static create(by: 'patient' | 'practice', reason?: string): Cancellation {
    const given = reason?.trim() ?? '';

    if (by === 'practice' && given.length === 0) {
      throw ReasonRequired.onCancellation();
    }

    return new Cancellation({ by, reason: given.length === 0 ? undefined : given });
  }
}

// application/commands/cancel-appointment/cancel-appointment.handler.ts
@CommandHandler(CancelAppointmentCommand)
export class CancelAppointmentHandler implements CommandHandler<CancelAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, appointmentId, reason }: CancelAppointmentCommand): Promise<string> {
    const target = await this.appointmentRepository.findById(appointmentId);

    if (target === undefined) {
      throw UnknownAppointment.forAppointment(appointmentId);
    }

    // Les politiques de la permission, avec le rendez-vous chargé : 403 quand l'une dit non.
    await this.access.authorize(actor, schedulingPermissions['appointment.cancel'], target);

    const cancellation = Cancellation.create(actor.id === target.patientId ? 'patient' : 'practice', reason);

    target.cancel(cancellation, this.clock.now());

    await this.appointmentRepository.save(target);

    return target.id;
  }
}
```

Le gestionnaire n'ouvre aucune transaction et ne publie rien : le bus de commandes l'exécute dans
une unité de travail. Les gestionnaires de l'événement du domaine `AppointmentCancelled` tournent
dans la même transaction (le créneau libéré est proposé à la liste d'attente, et un *publisher*
écrit l'événement d'intégration `scheduling.appointment.cancelled` dans l'outbox), et tout est
validé ensemble, ou rien ne l'est. Après la validation, le relais publie l'événement :
`notification` prévient le patient et `analytics` enregistre l'issue, en dehors de cette requête
HTTP.

**Une pratique qu'il montre : une règle sur les droits est une politique, pas un `if` dans le
gestionnaire.** Au lieu de tester l'acteur dans le gestionnaire :

```ts
// Invisible pour qui lit les permissions, testée seulement à travers le gestionnaire, et le contexte nomme maintenant un rôle.
if (actor.roles.includes('patient') && appointment.slot.startsAt.getTime() - now.getTime() < 24 * HOUR) {
  throw new ForbiddenError('Too late to cancel');
}
```

écrivez la règle comme une politique de la permission, comme plus haut : `Access.authorize`
l'exécute, son nom est la raison du refus, elle a sa propre *spec* (listée plus bas), et les
contextes continuent de ne nommer que des permissions. La règle
[`authz/in-application`](../docs/ARCHITECTURE.fr.md#3-règles-de-dépendance) dit où un droit est
décidé ; [Authentification et autorisation](../docs/concepts/authentication-and-authorization.fr.md)
explique pourquoi.

Les fichiers, sous `examples/scheduling/` (`<s>` désigne `src/contexts/scheduling`) :

| Partie | Fichier |
|---|---|
| route | `<s>/presentation/http/appointments/cancel-appointment/cancel-appointment.controller.ts` |
| commande et sa permission | `<s>/application/commands/cancel-appointment/cancel-appointment.command.ts` |
| gestionnaire | `<s>/application/commands/cancel-appointment/cancel-appointment.handler.ts` |
| politique et sa *spec* | `<s>/application/authorization/patient-cancels-until-notice.policy.ts`, `<s>/test/unit/patient-cancels-until-notice.policy.spec.ts` |
| objet-valeur | `<s>/domain/value-objects/cancellation.vo.ts` |
| agrégat et sa machine à états | `<s>/domain/aggregates/appointment.aggregate.ts`, `<s>/domain/state-machines/appointment.state-machine.ts` |
| réactions dans la même transaction | `<s>/application/event-handlers/appointment-cancelled.event-handler.ts`, `<s>/application/integration/publishers/appointment-cancelled.publisher.ts` |
| le statut HTTP de chaque refus | `src/platform/http/error-statuses.ts` |
| tout le chemin, de bout en bout | `test/e2e/journey-authorization.e2e.spec.ts` |

## Le lancer

**La porte, sans aucun conteneur.** Depuis la racine du dépôt :

```bash
npm ci && npm run build && npm run example:verify
```

`example:verify` lance deux choses :

| Partie | Ce qu'elle prouve |
|---|---|
| `npm run verify` de l'exemple | les types, le lint avec le *preset* du kit, le format, les tests unitaires et d'adaptateurs avec la couverture, les *specs* de bout en bout, les règles d'architecture (`ddd-ts-kit check`), le graphe des imports, le code mort, et la dérive des documents générés |
| `npm run example:conformance` | chaque règle du catalogue est enfreinte une fois dans une copie de l'exemple et doit être signalée, sur le fichier qui l'enfreint, par chaque analyseur qui la porte ; la copie intacte ne signale rien |

**L'exécution réelle.** Avec Docker, l'exemple démarre ses propres PostgreSQL, Dragonfly, Varnish,
Keycloak, Jaeger et GlitchTip, puis un script joue le scénario de la
[transcription de la démonstration](scheduling/docs/demo-transcript.fr.md) avec de vrais jetons :
les trois commandes sont dans [Le lancer en trois commandes](scheduling/README.fr.md#le-lancer-en-trois-commandes), et les
utilisateurs de la démonstration dans [Les utilisateurs de démonstration](scheduling/README.fr.md#les-utilisateurs-de-démonstration).

## Où lire ensuite

- [Le README de l'exemple](scheduling/README.fr.md) : ce que montre l'exemple et où regarder,
  les règles métier par contexte, le modèle d'autorisation avec deux cas détaillés, la trace d'une
  réservation.
- [Carte des contextes](scheduling/docs/context-map.fr.md) et [Intégration](scheduling/docs/integration/README.fr.md) :
  comment les quatre contextes collaborent.
- Les décisions : [ADR 0001](scheduling/docs/adr/0001-combine-token-roles-with-relationships-in-one-authorizer.fr.md)
  (les rôles et les relations dans un seul autorisateur),
  [ADR 0002](scheduling/docs/adr/0002-keep-read-models-with-projections-in-application-projections.fr.md)
  (remplacé), [ADR 0003](scheduling/docs/adr/0003-one-network-is-one-tenant.fr.md) (un réseau
  de cabinets est un *tenant*),
  [ADR 0004](scheduling/docs/adr/0004-attendance-records-wait-for-a-tenant-in-the-event-store.fr.md)
  (les relevés de présence attendent un *tenant* dans l'*event store*).
- [Rapport sur l'outillage](scheduling/docs/tooling-report.fr.md) : combien de temps chaque étape a
  pris, ce que le générateur a refusé, les défauts trouvés dans le kit et ce qui n'est pas construit.
