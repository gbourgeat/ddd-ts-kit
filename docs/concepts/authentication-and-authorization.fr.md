[English](authentication-and-authorization.md) · **Français**
<!-- translation-of: authentication-and-authorization.md sha256:d2f305d4352f1dda -->

# Authentification et autorisation

**Résumé.** L'authentification répond à « qui appelle », l'autorisation à « cet acteur a-t-il
le droit de faire ceci, sur cet élément ». Ce sont deux responsabilités qui ont deux places :
l'authentification est une préoccupation de la plateforme, à la frontière ; l'autorisation est
une préoccupation de l'application, déclarée par cas d'usage et tranchée à travers un seul port.
Le modèle derrière ce port est un choix : des rôles (RBAC), des politiques sur des attributs
(ABAC) ou des relations à la manière de Google Zanzibar (ReBAC). Cette page explique les trois,
les compare honnêtement et montre comment le kit garde ce choix réversible. Une troisième
question, « est-ce une chose valide à faire, tout simplement », relève d'un invariant et est
traitée dans [Invariants, permissions, validation](invariants-permissions-validation.fr.md).

## Deux questions, deux places

| | Authentification | Autorisation |
|---|---|---|
| Question | qui appelle ? | cet acteur a-t-il le droit de faire ceci, sur ceci ? |
| Entrée | un justificatif (un jeton *bearer*, un cookie de session, une clé d'API) | un acteur, une permission, parfois un élément |
| Sortie | un acteur et une session, sous forme de simples données | autorisé, ou refusé avec un code de raison stable |
| Où | la plateforme, à la frontière | la couche application de chaque contexte |
| Change quand | le fournisseur d'identité change | le métier change qui a le droit de faire quoi |

Les garder séparées a un effet concret. Le fournisseur d'identité peut être remplacé sans
toucher un cas d'usage, et une règle métier sur les droits peut changer sans toucher une route.
Le justificatif ne voyage jamais vers l'intérieur : la frontière le transforme en un `Actor`
(sujet, *tenant*, rôles ou attributs) et une `Session` (comment et quand l'acteur s'est
authentifié), et à partir de là seules ces données circulent. Le jeton lui-même n'est conservé
nulle part.

![Le chemin d'une requête HTTP : l'authentificateur de la plateforme transforme le jeton bearer en un Actor et une Session ; la route construit la commande avec cet acteur ; le middleware d'autorisation du bus de commandes refuse avec FORBIDDEN avant toute transaction, ou laisse le gestionnaire s'exécuter ; le gestionnaire charge le rendez-vous et interroge Access, qui exécute les politiques puis l'autorisateur ; l'agrégat garantit les invariants](../assets/diagrams/authentication-and-authorization-request-flow.fr.svg)

## Refus par défaut, déclaré par cas d'usage

Chaque commande, requête et route dit quelle permission elle exige, ou dit qu'elle est publique.
Il n'y a pas de troisième état : un cas d'usage auquel personne n'a pensé n'est pas accessible.
C'est la règle [`authz/declared`](../ARCHITECTURE.fr.md#3-règles-de-dépendance).

Une permission est une donnée qui appartient au contexte, nommée dans son langage omniprésent
(ubiquitous language) : `appointment.book`, `appointment.cancel`, `calendar.manage`. Ce n'est
pas un rôle. Les rôles comme « réceptionniste » ou « praticien » appartiennent au modèle choisi
dans la racine de composition ; le code d'un contexte ne nomme que des permissions. C'est cette
séparation qui permet au modèle de changer plus tard.

Dans le domaine de l'exemple :

| Cas d'usage | Exige | Pourquoi pas simplement un test de rôle |
|---|---|---|
| `BookAppointment` | `appointment.book` | un client, un réceptionniste et un partenaire d'intégration peuvent tous réserver ; la liste changera |
| `CancelAppointment` | `appointment.cancel`, plus une politique | « seulement le client qui a réservé, ou le praticien » dépend du rendez-vous chargé |
| `SetWorkingHours` | `calendar.manage` | sur le calendrier de ce praticien, pas sur tous les calendriers |
| `FindOpenSlots` | publique | déclarée publique à dessein, pas par omission |

Dans le code, les permissions sont des données du contexte, et chaque message dit ce qu'il
exige ou qu'il est public. Le *middleware* lit ces déclarations ; le gestionnaire (handler) ne
les répète pas.

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, Query, type Actor } from '@ddd-ts-kit/kernel';
import { Public, Requires } from '@ddd-ts-kit/kernel/declarations';

// application/authorization/appointments.permissions.ts : des données qui appartiennent au contexte, dans ses mots.
export const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment for a client' },
  'appointment.cancel': { description: 'Cancel a booked appointment' },
});
// appointmentsPermissions['appointment.cancel'].id vaut 'appointments:appointment.cancel'

// Protégée : seul un acteur qui détient la permission atteint le gestionnaire. L'acteur vient en premier.
@Requires(appointmentsPermissions['appointment.cancel'], {
  resource: (command: CancelAppointment) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CancelAppointment extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly reason: string,
  ) {
    super(actor);
  }
}

// Publique à dessein : c'est dit, jamais sous-entendu.
@Public()
export class FindOpenSlots extends Query<readonly Date[]> {
  constructor(
    readonly practitionerId: string,
    readonly day: string,
  ) {
    super();
  }
}
```

Un projet généré avec le style explicite écrit la même exigence à côté de l'enregistrement du
gestionnaire, `.requires(permission)` ou `.public()` ; voir
[`@ddd-ts-kit/auth`](../../packages/auth/README.fr.md) pour les deux styles.

La décision est prise dans la couche application, avant que le gestionnaire s'exécute et avant
qu'une transaction s'ouvre. Une route construit la commande et rien d'autre ; un *repository*
applique le périmètre d'accès qu'on lui transmet et rien d'autre ; le domaine ne connaît aucun
acteur. C'est la règle
[`authz/in-application`](../ARCHITECTURE.fr.md#3-règles-de-dépendance).

## Les règles qui ont besoin de l'élément chargé

« Un client ne peut annuler que son propre rendez-vous » ne peut pas se trancher à partir de la
seule commande : il faut d'abord charger le rendez-vous. Une telle règle est une politique
(policy) : une fonction pure et nommée, rangée dans `application/authorization/`, avec sa propre
*spec*. Le gestionnaire charge l'agrégat et interroge l'autorisateur avec lui.

<!-- checked sample -->
```ts
import { Access, definePermissions, definePolicy } from '@ddd-ts-kit/auth';
import {
  AggregateRoot,
  AuthorizedCommand,
  Clock,
  NotFoundError,
  Repository,
  type Actor,
  type CommandHandler,
} from '@ddd-ts-kit/kernel';

// Déclarés ici pour que l'exemple compile seul ; dans un projet, ce sont des fichiers du contexte.
declare class Appointment extends AggregateRoot {
  readonly clientId: string;
  readonly practiceId: string;
  cancel(reason: string, at: Date): void;
}
declare abstract class AppointmentRepository extends Repository<Appointment> {}
declare class CancelAppointment extends AuthorizedCommand {
  readonly appointmentId: string;
  readonly reason: string;
}
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.cancel': { description: 'Cancel a booked appointment' },
});

// appointments/application/authorization/only-the-client-or-the-practice-cancels.policy.ts
export const onlyTheClientOrThePracticeCancels = definePolicy<Appointment>({
  name: 'appointment.only-the-client-or-the-practice-cancels',
  permission: appointmentsPermissions['appointment.cancel'],
  appliesTo: (subject): subject is Appointment => subject instanceof Appointment,
  allows: (actor: Actor, appointment) =>
    actor.id === appointment.clientId || actor.attributes['practiceId'] === appointment.practiceId,
});

// appointments/application/commands/cancel-appointment/cancel-appointment.handler.ts
export class CancelAppointmentHandler implements CommandHandler<CancelAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly access: Access,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);

    if (appointment === undefined) {
      throw new NotFoundError('Appointment not found');
    }

    await this.access.authorize(command.actor, appointmentsPermissions['appointment.cancel'], appointment);

    appointment.cancel(command.reason, this.clock.now());
    await this.appointments.save(appointment);
  }
}
```

`Access.authorize` exécute chaque politique de la permission, puis l'autorisateur, et lève une
`ForbiddenError` (code `FORBIDDEN`, répondu en 403) dont la raison est le nom de la politique qui
a dit non. Une politique est un simple objet, sa *spec* n'a donc besoin de rien d'autre :

<!-- checked sample -->
```ts
import type { Policy } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { expect, it } from 'vitest';

interface Appointment {
  readonly clientId: string;
  readonly practiceId: string;
}
declare const onlyTheClientOrThePracticeCancels: Policy<Appointment>;
declare const appointment: Appointment; // réservé par client-1 au cabinet practice-7

const now = new Date('2026-03-01T09:00:00.000Z');

it('lets the client who booked cancel, and nobody else outside the practice', () => {
  const client = anActor().named('client-1').build();
  const stranger = anActor().named('client-2').build();

  expect(onlyTheClientOrThePracticeCancels.allows(client, appointment, { now })).toBe(true);
  expect(onlyTheClientOrThePracticeCancels.allows(stranger, appointment, { now })).toBe(false);
});
```

La même règle écrite à la main dans le gestionnaire fonctionnerait une fois et ne se
retrouverait nulle part ailleurs :

```ts
// au lieu de : une règle de droits cachée dans un gestionnaire, avec sa propre erreur, invisible du journal d'audit
if (appointment.clientId !== command.actor.id) {
  throw new Error('not your appointment');
}

// écrivez : un seul appel ; la règle est une politique nommée, avec sa spec, sa raison de refus et sa trace d'audit
await this.access.authorize(command.actor, appointmentsPermissions['appointment.cancel'], appointment);
```

Le test qui distingue une politique d'un invariant : la règle tiendrait-elle quel que soit celui
qui demande ? « Pas après l'expiration du délai d'annulation » vaut pour tout le monde, c'est
donc un invariant de l'agrégat (`AppointmentError.cancellationWindowPassed`, code
`CANCELLATION_WINDOW_PASSED`). « Seulement le client qui a réservé » dépend de qui demande,
c'est donc une politique.

## Les recherches sont filtrées dans la requête SQL

Charger tous les rendez-vous et filtrer en mémoire laisse fuiter des décomptes, casse la
pagination et coûte cher. Le gestionnaire demande à l'autorisateur le périmètre d'accès de
l'acteur (tout, rien, un ensemble d'identifiants ou un filtre) et le transmet au port de lecture ;
l'adaptateur le transforme en condition de la requête SQL. `SearchAppointments` pour un client
ne lit donc que les lignes de ce client, et la page 2 reste la page 2.

<!-- checked sample -->
```ts
import { Access, definePermissions, type AccessScope } from '@ddd-ts-kit/auth';
import { AuthorizedQuery, type Actor, type QueryHandler } from '@ddd-ts-kit/kernel';

const appointmentsPermissions = definePermissions('appointments', {
  'appointment.read': { description: 'Read appointments' },
});

export interface AppointmentRow {
  readonly id: string;
  readonly clientId: string;
  readonly startsAt: string;
}

// application/ports/appointment-search.port.ts : le port de lecture reçoit un périmètre, jamais un acteur.
export abstract class AppointmentSearch {
  abstract search(scope: AccessScope, limit: number): Promise<readonly AppointmentRow[]>;
}

export class SearchAppointments extends AuthorizedQuery<readonly AppointmentRow[]> {
  constructor(
    actor: Actor,
    readonly limit: number,
  ) {
    super(actor);
  }
}

export class SearchAppointmentsHandler implements QueryHandler<SearchAppointments> {
  constructor(
    private readonly access: Access,
    private readonly appointments: AppointmentSearch,
  ) {}

  async execute(query: SearchAppointments): Promise<readonly AppointmentRow[]> {
    // { kind: 'all' }, { kind: 'none' }, { kind: 'ids', ids } ou { kind: 'filter', filter }
    const scope = await this.access.scope(query.actor, appointmentsPermissions['appointment.read'], 'appointment');

    return this.appointments.search(scope, query.limit);
  }
}
```

L'adaptateur du port transforme le périmètre en condition de sa requête SQL (ici avec Knex) :

```ts
function visibleTo(appointments: Knex.QueryBuilder, scope: AccessScope): Knex.QueryBuilder {
  if (scope.kind === 'none') {
    return appointments.whereRaw('false');
  }

  if (scope.kind === 'ids') {
    return appointments.whereIn('id', [...scope.ids]);
  }

  return scope.kind === 'filter' ? appointments.where({ tenant_id: scope.filter['tenantId'] }) : appointments;
}
```

## Trois modèles

### Rôles (RBAC)

L'acteur a des rôles ; un rôle accorde des permissions. La question est « l'un des rôles de
l'acteur accorde-t-il cette action ». Le modèle convient quand les droits suivent les fonctions
et sont les mêmes pour chaque élément : un réceptionniste peut réserver pour n'importe qui, un
administrateur peut gérer tous les calendriers. Il est peu coûteux (aucune entrée-sortie par
vérification) et facile à expliquer à un auditeur.

Sa limite, c'est l'élément. Dès que « peut modifier » dépend du calendrier concerné, RBAC répond
par davantage de rôles (`practitioner-of-calendar-42`) : c'est l'explosion des rôles contre
laquelle la littérature met en garde.

![Trois modèles côte à côte. Rôles : l'acteur a des rôles, un rôle accorde des permissions, la même réponse pour chaque élément. Politiques sur attributs : les attributs de l'acteur, de la ressource et du moment alimentent des règles permit et forbid, et un forbid applicable l'emporte. Relations : des tuples stockés relient le calendrier 42 à sa propriétaire Ada et à sa clinique parente 7, dont Bob est membre, si bien qu'un chemin de tuples donne le calendrier à Bob](../assets/diagrams/authentication-and-authorization-three-models.fr.svg)

### Politiques sur attributs (ABAC)

Une règle lit des attributs de l'acteur, de la ressource et du moment : « un réceptionniste
peut réserver pour les praticiens de sa propre clinique, pendant les heures d'ouverture, et
jamais pour un client suspendu ». Le modèle convient quand les droits dépendent de propriétés
plutôt que de l'identité, et quand il faut des refus explicites (un *forbid* applicable
l'emporte sur tous les *permit*).

Ses coûts : les attributs de la ressource doivent être disponibles au moment de la décision
(une projection ou un cache à entretenir), les règles se dispersent et demandent des tests et de
la discipline, et un prédicat n'est pas une requête : lister « tout ce que cet acteur peut voir »
n'est pas une question à laquelle un moteur ABAC pur répond.

### Relations (ReBAC, d'après Zanzibar)

Les droits suivent des relations stockées entre sujets et objets, écrites sous forme de tuples
`object#relation@subject` : `calendar:42#owner@user:ada`, `clinic:7#member@user:bob`,
`calendar:42#parent@clinic:7`. Les permissions sont des relations qui en dérivent : « peut gérer un
calendrier : son propriétaire, ou un membre de sa clinique parente ». Les deux opérations de base
sont la vérification (existe-t-il un chemin de cet objet à cet acteur) et la liste (quels objets
cet acteur peut-il atteindre).

Le modèle convient quand les droits portent sur chaque élément et sont partagés : propriété,
équipes, délégation (« mon assistant gère mon calendrier »), hiérarchies. Il répond aux listes
par construction. Ses coûts : les tuples doivent être écrits chaque fois qu'un agrégat est créé
ou partagé, et tenus synchronisés ; une vérification coûte plusieurs lectures, bornées par une
profondeur maximale ; la liste croît avec ce que l'acteur peut atteindre ; et à grande échelle,
l'évaluation part dans un service dédié qui a son propre modèle de cohérence.

## Une comparaison honnête

| | RBAC | ABAC | ReBAC |
|---|---|---|---|
| Granularité | l'action (plus une vérification du *tenant*) | l'élément, par les attributs que vous fournissez | l'élément, par construction |
| Données à entretenir | une table des rôles, les rôles dans le jeton | les attributs des ressources | les tuples de relation |
| Coût d'une vérification | constant, aucune entrée-sortie | une lecture d'attributs | plusieurs lectures de tuples |
| Liste des éléments accessibles | tous, aucun ou un filtre par *tenant* | non disponible | des identifiants, par expansion inverse |
| Expliquer une décision | quel rôle | quelle règle s'est appliquée | quel chemin de tuples |
| Échec typique | l'explosion des rôles | des règles dispersées et non testées | des tuples désynchronisés |

Ces chiffres sont ceux des trois autorisateurs en processus du kit, tels que les énonce
[`@ddd-ts-kit/auth`](../../packages/auth/README.fr.md) ; un service dédié change les coûts, pas
la forme. Voir [Moteurs d'autorisation](../tools/authorization-engines.fr.md).

## Table de décision

| Situation | Commencer par | Raison |
|---|---|---|
| Les droits suivent les fonctions, peu d'exceptions par élément | RBAC | le modèle le plus simple qui fonctionne |
| Une poignée de règles par élément (« seulement celui qui a réservé ») en plus des rôles | RBAC plus des politiques | aucun stockage de tuples nécessaire |
| Les droits dépendent de propriétés : clinique, montant, statut, heure de la journée, refus explicites | ABAC | les règles lisent des attributs |
| Les utilisateurs partagent des éléments entre eux, délégation, groupes ou dossiers imbriqués | ReBAC | la relation est la donnée |
| Produit multitenant où le *tenant* est la seule frontière | RBAC avec la vérification du *tenant* | une relation par ligne serait du gaspillage |
| Les listes doivent être restreintes par acteur sur de nombreux éléments | ReBAC, ou RBAC avec un filtre par *tenant* | ABAC ne sait pas répondre à une liste |
| Contexte réglementé qui exige des règles de refus explicites | ABAC par-dessus les rôles | un *forbid* qui l'emporte |

Les modèles se combinent. Des rôles pour les droits grossiers et des politiques par instance
pour les quelques règles qui portent sur un élément : c'est le point de départ de la plupart des
projets, et c'est ce qu'utilise le domaine de l'exemple : les rôles accordent `appointment.book` et
`calendar.manage`, une politique garde l'annulation. Si plus tard les clients délèguent leurs
réservations à des proches, ou si les praticiens partagent leurs calendriers avec des
assistants, le contexte des calendriers passe aux relations.

Assemblée à la main, cette combinaison tient en deux objets ; `authorizationModule` de
`@ddd-ts-kit/auth/di` lie le même `PolicyAccess` dans un projet :

<!-- checked sample -->
```ts
import { definePermissions, definePolicy, PolicyAccess, RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { FixedClock } from '@ddd-ts-kit/kernel';

const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment for a client' },
  'appointment.cancel': { description: 'Cancel a booked appointment' },
});
const calendarsPermissions = definePermissions('calendars', {
  'calendar.manage': { description: 'Set the working hours of a calendar' },
});

interface BookedAppointment {
  readonly clientId: string;
  readonly practiceId: string;
}

const onlyTheClientOrThePracticeCancels = definePolicy<BookedAppointment>({
  name: 'appointment.only-the-client-or-the-practice-cancels',
  permission: appointmentsPermissions['appointment.cancel'],
  allows: (actor, appointment) =>
    actor.id === appointment.clientId || actor.attributes['practiceId'] === appointment.practiceId,
});

// Des rôles pour les droits grossiers : la même réponse pour chaque élément.
const authorizer = new RoleBasedAuthorizer({
  roles: {
    client: [appointmentsPermissions['appointment.book'], appointmentsPermissions['appointment.cancel']],
    receptionist: ['appointments:*'],
    practitioner: [calendarsPermissions['calendar.manage']],
  },
  inherits: { practitioner: ['receptionist'] },
});

// Access interroge d'abord les politiques de la permission, puis l'autorisateur.
const access = new PolicyAccess({
  authorizer,
  policies: [onlyTheClientOrThePracticeCancels],
  clock: new FixedClock(new Date('2026-03-01T09:00:00.000Z')),
});

const ada = anActor().named('client-ada').withRole('client').build();
const appointmentOfBob: BookedAppointment = { clientId: 'client-bob', practiceId: 'practice-7' };

// { allowed: false, reason: 'appointment.only-the-client-or-the-practice-cancels' }
export const decision = await access.decide(ada, appointmentsPermissions['appointment.cancel'], appointmentOfBob);
```

Les questions à se poser, dans l'ordre, et un préréglage détaillé pour chaque modèle (des
permissions et des rôles typés, une politique sur un élément, une recherche restreinte par
périmètre) sont dans le guide [Choisir le contrôle d'accès](../guides/choosing-access-control.fr.md).

## Ce qui change quand le modèle change

L'adaptateur fourni au module d'autorisation, et les données dont cet adaptateur a besoin. Des
rôles aux relations : chaque exigence nomme l'élément sur lequel elle porte (une relation est
toujours une relation à quelque chose), chaque permission est associée à une permission du
schéma, et l'application commence à écrire des tuples. Les permissions, les commandes, les
requêtes, les gestionnaires, les politiques, les routes et les tests des gestionnaires ne
changent pas. C'est le sens concret de « derrière un seul port ».

Les tuples sont écrits par un port nommé dans les mots de l'application (un `CalendarGrants`
avec `ownerAssigned`), jamais par le domaine. Écrits dans le gestionnaire, le tuple et l'agrégat
sont validés ensemble quand le stockage des tuples repose sur SQL. Un gestionnaire d'un
événement du domaine de l'agrégat peut appeler le même port avec la même garantie : les
événements du domaine sont distribués à la fin de l'unité de travail de la commande, avant sa
validation (commit). Écrite par une réaction à un événement d'intégration, l'écriture est une
seconde étape qui doit être idempotente et retentée, et l'agrégat existe un court instant sans
sa relation.

## Limites et quand ne pas l'utiliser

- **Déclarer une permission ne rend pas le modèle juste.** Les règles vérifient que chaque cas
  d'usage déclare quelque chose et que les décisions se prennent dans la couche application.
  Elles ne peuvent pas dire si `appointment.book` est accordée aux bons rôles.
- **Les vérifications au niveau du texte ratent certaines formes.** Un test de propriété écrit à
  la main (`appointment.clientId === actor.id`) dans un gestionnaire ou une route n'est pas
  détecté, comme le dit le README de la CLI. La revue reste nécessaire.
- **Une session révoquée vit jusqu'à l'expiration de son jeton.** Les authentificateurs JWT et
  Keycloak vérifient les signatures avec un jeu de clés et n'appellent jamais le fournisseur à
  chaque requête HTTP. Gardez des durées de vie courtes pour les jetons d'accès, ou ajoutez une
  vérification de révocation derrière le port `Authenticator`.
- **ReBAC en processus ne passe pas à l'échelle indéfiniment.** Une liste coûte une lecture du
  stockage par sujet atteint. Au-delà d'une certaine taille, la vérification revient à un service
  dédié ; le port reste.
- **ABAC ne propose aucune liste** dans le kit : un prédicat n'est pas une requête.
- **Le filtrage par *tenant* dans un *repository* est une défense en profondeur, pas une
  autorisation.** Il empêche un bogue de laisser fuiter des lignes ; la permission reste
  tranchée dans la couche application.
- **Tous les projets n'en ont pas besoin.** Un outil interne mono-utilisateur sans droits au
  niveau de l'élément peut déclarer ses cas d'usage avec une permission chacun et un seul rôle,
  et s'arrêter là.

## Sources

- Ruoming Pang et al., « Zanzibar: Google's Consistent, Global Authorization System », USENIX
  Annual Technical Conference, 2019.
- David F. Ferraiolo et D. Richard Kuhn, « Role-Based Access Controls », 15th National Computer
  Security Conference, 1992 ; ANSI INCITS 359-2004 (norme RBAC).
- Vincent C. Hu et al., « Guide to Attribute Based Access Control (ABAC) Definition and
  Considerations », NIST Special Publication 800-162, 2014.
- RFC 7519 (JSON Web Token), RFC 8176 (Authentication Method Reference Values), RFC 8693 (OAuth
  2.0 Token Exchange), OpenID Connect Core 1.0.
- OWASP Top 10 (2021), A01 Broken Access Control : refus par défaut et contrôle d'accès appliqué
  dans du code de confiance côté serveur.
- [`@ddd-ts-kit/auth`](../../packages/auth/README.fr.md), la référence pour l'API et pour les
  chiffres de la table de comparaison.

## Voir aussi

- [L'autorisation en pratique](authorization-in-practice.fr.md) : une commande suivie à travers la mécanique
- [Invariants, permissions, validation](invariants-permissions-validation.fr.md)
- [Acteur et portée d'exécution](actor-and-execution-scope.fr.md)
- [Journal d'audit](audit-trail.fr.md)
- [Choisir le contrôle d'accès](../guides/choosing-access-control.fr.md) : le guide de décision et
  les préréglages détaillés
- [Multitenance](multitenancy.fr.md)
- [Fournisseurs d'identité](../tools/identity.fr.md)
- [Moteurs d'autorisation](../tools/authorization-engines.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md) : règles `authz/declared`,
  `authz/in-application`, `authz/actor-explicit`
