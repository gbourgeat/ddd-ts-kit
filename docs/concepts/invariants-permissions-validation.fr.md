[English](invariants-permissions-validation.md) · **Français**
<!-- translation-of: invariants-permissions-validation.md sha256:3f728429f18fede0 -->

# Invariants, permissions et validation

**Résumé.** Il existe trois sortes de « cette requête est refusée » dans une application métier,
et ce sont des choses différentes. La validation demande si l'entrée est bien formée. Une
permission demande si cet acteur peut faire ceci, sur cet élément. Un invariant demande si
l'action est valide tout court, qui que ce soit qui la demande. Ce kit donne à chacune sa propre
couche, son propre mécanisme et sa propre sorte d'erreur : la validation à la frontière derrière
le port `Schema`, les permissions dans la couche application derrière le port `Authorizer`, les
invariants dans le domaine sous forme de `DomainError`. Les mélanger est la façon habituelle dont
les règles métier finissent dans les contrôleurs et les règles d'accès dans les entités.

## Trois questions

| | Validation | Permission | Invariant |
|---|---|---|---|
| Question | l'entrée est-elle bien formée ? | cet acteur peut-il faire ceci, sur ceci ? | est-ce une chose valide à faire, tout court ? |
| Dépend de | la requête HTTP seule | l'acteur, l'action, parfois l'élément | l'état du modèle |
| Connaît l'acteur | non | oui | jamais |
| Connaît l'état enregistré | non | parfois (une politique) | oui |
| Vit dans | `presentation/` | `application/authorization/` | `domain/` |
| Mécanisme | un schéma de la bibliothèque de validation du projet, derrière le port `Schema` | une permission déclarée sur le cas d'usage, décidée par le port `Authorizer` ; une politique (policy) pour une règle sur un élément | un contrôle à l'intérieur d'un agrégat, d'un objet-valeur ou d'un service du domaine |
| Vérifiée | avant qu'une commande existe | avant que le gestionnaire s'exécute (et par le gestionnaire, pour une politique) | quand la méthode de l'agrégat s'exécute |
| Refus | des problèmes de validation, un 422 | non authentifié ou interdit, un 401 ou un 403 | une `DomainError` avec un code stable, associé une seule fois à un statut |
| Exemple | `startsAt` est une date-heure ISO | seul le client qui a réservé, ou le praticien, peut annuler | un rendez-vous annulé ne peut pas être reprogrammé |

Un critère simple : **la règle tiendrait-elle encore si un administrateur doté de tous les droits
envoyait une requête parfaitement formée ?** Si oui, c'est un invariant. Si la réponse dépend de
qui demande, c'est une permission. Si la requête ne pouvait même pas être comprise, c'est de la
validation.

![Un arbre de décision : une requête qui ne peut pas être comprise relève de la validation ; une règle qui tient qui que ce soit qui demande est un invariant ; une règle qui dépend de qui demande est une permission, et une politique quand elle dépend aussi de l'élément ; ce qu'un tenant peut voir relève du cloisonnement par tenant](../assets/diagrams/invariants-permissions-validation-which-rule.fr.svg)

## La même fonctionnalité, vue de trois façons

Annuler un rendez-vous.

![Le chemin d'une annulation : le schéma à la frontière répond 422 à une requête mal formée ; la permission vérifiée par le bus répond 401 ou 403 ; la politique sur le rendez-vous chargé répond 403 ; les invariants de l'agrégat répondent une erreur du domaine avec son code ; alors seulement le rendez-vous est enregistré et son événement consigné](../assets/diagrams/invariants-permissions-validation-three-checks.fr.svg)

**1. La validation, à la frontière.** La route déclare la forme de l'entrée. Elle ne sait rien
des rendez-vous au-delà du format de leur identifiant.

<!-- checked sample -->
```ts
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// presentation/http : le schéma de requête de la route (zod ici)
export const cancelAppointmentBody = zodSchema(
  z.object({
    reason: z.enum(['client-request', 'practitioner-unavailable', 'other']),
    note: z.string().max(500).optional(),
  }),
);
```

**2. La permission, dans l'application.** Le cas d'usage déclare ce qu'il exige ; un
*middleware* du bus interroge l'*authorizer* avant que le gestionnaire (handler) s'exécute. Rien
n'est accessible par défaut (`authz/declared`).

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';

// application/authorization/appointments.permissions.ts
export const permissions = definePermissions('appointments', {
  'appointment.cancel': { description: 'Cancel an appointment' },
});

// application/commands/cancel-appointment/cancel-appointment.command.ts
@Requires(permissions['appointment.cancel'], {
  resource: (command: CancelAppointment) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CancelAppointment extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly reason: string,
  ) {
    super(actor);
  }
}
```

« Seul le client qui l'a réservé, ou son praticien » dépend du rendez-vous chargé. C'est une
politique dans `application/authorization/*.policy.ts` : une règle nommée et testée unitairement,
que le gestionnaire évalue une fois l'agrégat chargé, par le port `Access` de `@ddd-ts-kit/auth`,
qui interroge chaque politique de la permission, puis l'*authorizer*.

<!-- checked sample -->
```ts
import { Access, definePermissions, type PolicyContext } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, ConceptError, isAuthenticated, type Actor, type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler, Policy } from '@ddd-ts-kit/kernel/declarations';

const permissions = definePermissions('appointments', {
  'appointment.cancel': { description: 'Cancel an appointment' },
});

declare class CancelAppointment extends AuthorizedCommand<void> {
  readonly appointmentId: string;
  readonly reason: string;
}

declare class Appointment {
  readonly clientId: string;
  readonly practitionerId: string;
  cancel(reason: string, at: Date): void;
}

declare abstract class AppointmentRepository {
  abstract findById(id: string): Promise<Appointment | undefined>;
  abstract save(appointment: Appointment): Promise<void>;
}

declare class AppointmentError extends ConceptError {
  static notFound(appointmentId: string): AppointmentError;
}

// application/authorization/own-appointment.policy.ts
/** Seul le client qui a réservé le rendez-vous, ou son praticien, peut l'annuler. */
@Policy(permissions['appointment.cancel'], { name: 'appointments.own-appointment' })
export class OwnAppointmentPolicy {
  appliesTo(subject: unknown): subject is Appointment {
    return subject instanceof Appointment;
  }

  allows(actor: Actor, appointment: Appointment, _context: PolicyContext): boolean {
    return isAuthenticated(actor) && (actor.id === appointment.clientId || actor.id === appointment.practitionerId);
  }
}

// application/commands/cancel-appointment/cancel-appointment.handler.ts
@CommandHandler(CancelAppointment)
export class CancelAppointmentHandler implements CommandHandler<CancelAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, appointmentId, reason }: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(appointmentId);

    if (appointment === undefined) {
      throw AppointmentError.notFound(appointmentId);
    }

    await this.access.authorize(actor, permissions['appointment.cancel'], appointment); // 403 quand une politique refuse
    appointment.cancel(reason, this.clock.now()); // les invariants : une DomainError quand l'un d'eux est violé
    await this.appointments.save(appointment);
  }
}
```

**3. Les invariants, dans le domaine.** L'agrégat refuse ce qui n'est jamais valide.

<!-- checked sample -->
```ts
import { AggregateRoot, ConceptError } from '@ddd-ts-kit/kernel';

const FREE_CANCELLATION_MS = 24 * 60 * 60_000;

export class AppointmentError extends ConceptError {
  static alreadyCancelled(appointmentId: string) {
    return AppointmentError.refusal('APPOINTMENT_ALREADY_CANCELLED', `Appointment ${appointmentId} is already cancelled.`, {
      appointmentId,
    });
  }

  static cancellationWindowPassed(appointmentId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'CANCELLATION_WINDOW_PASSED',
      `Appointment ${appointmentId} starts at ${startsAt.toISOString()}: free cancellation ended 24 hours before.`,
      { appointmentId, startsAt },
    ).exposing('startsAt');
  }
}

export class Appointment extends AggregateRoot<string> {
  private cancelledFor: string | undefined;

  constructor(
    id: string,
    private readonly startsAt: Date,
  ) {
    super(id);
  }

  /** Aucun acteur : ces règles tiennent qui que ce soit qui demande. */
  cancel(reason: string, at: Date): void {
    this.assertNotCancelled();
    this.assertCancellationStillFree(at);
    this.cancelledFor = reason;
    // puis enregistrer l'événement, voir Agrégats
  }

  private assertNotCancelled(): void {
    if (this.cancelledFor !== undefined) {
      throw AppointmentError.alreadyCancelled(this.id);
    }
  }

  private assertCancellationStillFree(at: Date): void {
    if (this.startsAt.getTime() - at.getTime() < FREE_CANCELLATION_MS) {
      throw AppointmentError.cancellationWindowPassed(this.id, this.startsAt);
    }
  }
}
```

La méthode de l'agrégat ne prend aucun acteur. Elle ne peut pas être trompée par un contrôle
oublié ailleurs, et ses tests n'ont besoin d'aucun utilisateur.

## Où chacun vit, et pourquoi

**La validation reste à l'extérieur** parce que la forme d'une requête HTTP est une affaire de
transport. Le même cas d'usage peut être atteint par HTTP, par un événement consommé ou par un
*job* planifié, chacun avec son propre format d'entrée. Le domaine n'importe jamais de
bibliothèque de validation (`layer/domain-purity`).

Les objets-valeurs brouillent la limite de façon utile : `TimeSlot.create` refuse une fin avant
son début. Ce n'est pas de la validation d'entrée, c'est la définition d'un créneau, et elle tient
pour tout appelant. Le schéma de la frontière vérifie que deux dates-heures ont été envoyées ;
l'objet-valeur vérifie qu'elles forment un créneau. Un léger recouvrement entre les deux est
normal et sans danger.

**Les permissions restent dans l'application** parce que qui peut faire quoi est la politique du
contexte sur ses cas d'usage, pas une propriété de son modèle. Les rôles, les attributs ou les
relations peuvent changer sans toucher à un agrégat, et le modèle d'autorisation peut être
remplacé derrière le port ([Authentification et autorisation](authentication-and-authorization.fr.md)).
Les identifiants de règle : `authz/declared`, `authz/in-application`, `authz/actor-explicit`.

**Les invariants restent dans le domaine** parce qu'ils sont le modèle. Ils doivent tenir sur
chaque chemin : HTTP, événement, *job*, test, un futur script d'import. Le seul endroit par où
passent tous les chemins est la méthode de l'agrégat.

La référence énonce une exception : un contexte dont le modèle est l'accès lui-même (gérer des
membres et des rôles est son métier) peut tenir des rôles dans son propre état. Un rôle est alors
une donnée du domaine, pas les droits de l'utilisateur qui agit.

## Pièges courants

| Piège | Ce qui ne va pas | Où cela doit vivre |
|---|---|---|
| `if (appointment.status === 'cancelled') return 409` dans une route | la règle est contournée par tout autre point d'entrée | un invariant dans `appointment.reschedule` |
| un schéma qui refuse un `startsAt` dans le passé | une règle métier (« pas de réservation dans le passé ») cachée dans la présentation, et dépendante d'une horloge | un invariant, avec `now` passé en paramètre |
| `if (user.role === 'admin')` dans un gestionnaire ou une route | des droits éparpillés, invisibles pour l'audit | une permission exigée par le cas d'usage |
| `appointment.cancel(reason, actor)` qui vérifie `actor.id === this.clientId` | un savoir sur l'accès dans le modèle ; chaque test a besoin d'un acteur | une politique dans `application/authorization/` |
| un indicateur `isAdmin` sur une entité du domaine qui décide de l'accès | l'accès qui fuit dans le modèle | des rôles ou des relations dans l'*authorizer* |
| une `DomainError` pour « champ manquant » | une requête mal formée atteint le domaine | la validation à la frontière |
| un 403 pour « rendez-vous déjà annulé » | on dit au client qu'il lui manque un droit qu'il a | une erreur du domaine associée à un conflit |
| charger une liste, puis la filtrer par droits en mémoire | fuite des décomptes, pagination cassée, lenteur | un périmètre d'accès fourni par l'*authorizer*, remis au port de lecture |
| se fier au schéma et sauter l'invariant | le prochain point d'entrée n'a pas de schéma | garder les deux : chacun répond à sa propre question |

Les deux erreurs qui mettent l'accès dans le modèle, à côté de ce qu'il faut écrire à la place :

<!-- checked sample -->
```ts
import { isAuthenticated, type Actor } from '@ddd-ts-kit/kernel';

declare function forbidden(): Error;

// Au lieu de : l'agrégat vérifie qui demande ; chaque test de cancel a besoin d'un acteur,
// et une règle sur les droits se cache dans le modèle, invisible pour le journal d'audit
export class AppointmentDecidingAccess {
  constructor(
    readonly clientId: string,
    readonly isAdmin: boolean,
  ) {}

  cancel(reason: string, actor: Actor): void {
    if (!this.isAdmin && (!isAuthenticated(actor) || actor.id !== this.clientId)) {
      throw forbidden();
    }
    // ...
  }
}

// Écrire : l'agrégat garde ses propres règles et ne prend aucun acteur ; qui peut annuler est la
// politique de la permission, évaluée par le gestionnaire (ci-dessus)
export class Appointment {
  constructor(readonly clientId: string) {}

  cancel(reason: string, at: Date): void {
    // les invariants seulement
  }
}
```

Les règles qui semblent ambiguës se séparent en général nettement avec le critère ci-dessus :

| Règle | Sorte | Raisonnement |
|---|---|---|
| l'annulation gratuite prend fin 24 heures avant le début | invariant | vrai pour tout le monde |
| un praticien peut annuler dans les 24 heures, un client non | politique | dépend de qui demande ; l'agrégat offre alors deux intentions, ou le gestionnaire choisit la méthode que l'acteur a le droit d'appeler |
| pas après le début du rendez-vous | invariant | tient qui que ce soit qui demande |
| un *tenant* ne voit que ses propres rendez-vous | ni l'un ni l'autre : le cloisonnement par *tenant*, appliqué par l'infrastructure à partir de la portée d'exécution | [Acteur et portée d'exécution](actor-and-execution-scope.fr.md) |

## Les erreurs, trois formes

- **La validation** produit une liste de problèmes avec leurs chemins (`items.0.sku`), répondue
  par le *pipeline* HTTP sous forme de document *problem* avec le statut 422.
- **Les refus d'authentification et d'autorisation** sont produits par la plateforme et le
  *middleware* d'autorisation, répondus en 401 ou 403.
- **Les invariants** lèvent des `DomainError` avec un `code` stable (`SLOT_TAKEN`,
  `CANCELLATION_WINDOW_PASSED`). La présentation associe les codes aux statuts du transport en
  un seul endroit, et chaque route déclare les codes qu'elle peut répondre, qui alimentent le
  contrat OpenAPI (`errors/known-code` garantit que chaque code déclaré existe). Une
  `DomainError` est une réponse, pas un incident : elle n'est pas envoyée à l'outil de suivi des
  erreurs.

### Comment s'écrit un refus

Une classe d'erreur par concept du langage, une fabrique (factory) statique par refus :

<!-- checked sample -->
```ts
// domain/errors/appointment.error.ts
import { ConceptError } from '@ddd-ts-kit/kernel';

declare const calendar: { readonly id: string };
declare const slot: { readonly startsAt: Date };

export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'SLOT_TAKEN',
      `The slot starting at ${startsAt.toISOString()} on calendar ${calendarId} is already held.`,
      { calendarId, startsAt },
    ).exposing('startsAt');
  }
}

// là où la règle est gardée
throw AppointmentError.slotTaken(calendar.id, slot.startsAt);
```

- **Le nom est celui du métier, deux fois.** La fabrique est ce que lit le développeur qui
  refuse ; le code, ce que lisent le client, le *mapper*, le journal d'audit et les tests. Ils
  disent les mêmes mots : `slotTaken` et `SLOT_TAKEN` (`errors/factory-name`). Un code nomme un
  seul refus d'un contexte (`errors/code-unique`).
- **Le concept est ce qui a été demandé**, pas la classe qui détecte le problème : un calendrier
  qui trouve un créneau occupé refuse avec `AppointmentError.slotTaken`, parce que l'appelant a
  demandé un rendez-vous. Les refus d'un objet-valeur sont des fabriques du concept qu'il
  décrit : `PersonError.invalidEmail(raw)`, levée par `Email.create` (ou renvoyée dans son
  `Result` sous `"stack.valueObjects": "result"`).
- **Les faits sont des données, et privées.** Ce à partir de quoi le message a été construit est
  gardé sur l'erreur sous `facts`, pour qu'un gestionnaire ou un test lise une date et non une
  phrase. Un fait n'atteint le client, sous `facts` dans le document *problem*, que lorsque la
  fabrique le nomme avec `.exposing(..)` ; rien de ce qui identifie une personne ne l'atteint
  jamais. Le message est répondu comme `detail` : n'y écrivez rien que l'appelant n'ait pas
  envoyé.
- **Rien en aval ne connaît la classe.** `isRefusal(error, 'SLOT_TAKEN')`,
  `AppointmentError.is(error, 'SLOT_TAKEN')`, `thenError('SLOT_TAKEN', { calendarId })`,
  `expectProblem(response, { status: 409, code: 'SLOT_TAKEN' })` : le code est la clé.
- **Une classe qui grossit nomme un second concept.** Au-delà d'une vingtaine de fabriques (un
  fichier tient 350 lignes), scindez-la selon un terme du glossaire, jamais selon une ligne
  technique.

Un projet écrit avec une classe par erreur (`new SlotTakenError(..)`) continue de fonctionner,
et `ddd-ts-kit error-factories` le convertit : [CONFIG.md](../CONFIG.fr.md), `stack.refusals`.

## Limites, et quand ne pas l'utiliser

- **La séparation est une discipline que les outils ne tiennent qu'en partie.**
  `authz/in-application` repère des noms et des formes : le README de la CLI précise qu'un test de
  propriété écrit `appointment.clientId === actor.id` échappe au *checker*, qui travaille au
  niveau du texte. La revue reste nécessaire.
- **Un cas d'usage sans aucune règle** (un contrôle de santé public, une liste de référence)
  n'a besoin d'aucune des trois, au-delà de se déclarer public. N'ajoutez pas de cérémonie par
  symétrie.
- **Les invariants sur un ensemble ne s'expriment pas entièrement dans un agrégat.** « Pas de
  double réservation » demande aussi une contrainte en base de données
  ([Agrégats](aggregates.fr.md)).
- **La validation côté client est une quatrième chose**, pour le seul confort de l'utilisateur.
  Elle ne remplace jamais le schéma de la frontière.
- **Certaines règles sont les deux.** « Un client peut réserver au plus trois rendez-vous par
  semaine » est un invariant sur un ensemble, coûteux à garder strictement ; décidez avec le
  métier s'il doit être exact (une contrainte ou un compteur dans la même transaction) ou s'il
  peut être approximatif (vérifié sur une projection).

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 6 (invariants et agrégats)
  et chapitre 9 (spécifications, rendre explicites les règles implicites).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitre 5
  (validation des entités) et chapitre 10.
- Robert C. Martin, *Clean Architecture*, Prentice Hall, 2017, chapitre 22 (les frontières et ce
  qui les traverse).
- RFC 9457, « Problem Details for HTTP APIs », rfc-editor.org/rfc/rfc9457.
- Dépôt : [ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 4, « Authentification et
  autorisation » et « Validation » ; `plugin/skills/access-control/SKILL.md`.

## Voir aussi

- [Agrégats](aggregates.fr.md)
- [Entités et objets-valeurs](entities-and-value-objects.fr.md)
- [Authentification et autorisation](authentication-and-authorization.fr.md)
- [Acteur et portée d'exécution](actor-and-execution-scope.fr.md)
- [Les couches et la règle de dépendance](layers-and-dependency-rule.fr.md)
- [Modèle anémique](anemic-model.fr.md)
- [Bibliothèques de validation](../tools/validation.fr.md)
- [Référence de l'architecture](../ARCHITECTURE.fr.md)
- [Index des concepts](README.fr.md)
