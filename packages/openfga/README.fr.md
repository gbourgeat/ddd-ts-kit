[English](README.md) · **Français**
<!-- translation-of: README.md sha256:a99cc5ff12d3495a -->

# @ddd-ts-kit/openfga

Les relations de [`@ddd-ts-kit/auth`](../auth/README.fr.md) sur [OpenFGA](https://openfga.dev),
l'implémentation de Zanzibar de la CNCF : les ports `RelationTupleStore` et `Authorizer` servis
par un serveur OpenFGA, et son modèle d'autorisation généré à partir du schéma de relations que
le projet déclare déjà avec `defineSchema`. Une seule source de vérité : le schéma ; le modèle en
est dérivé et comparé à ce que détient le serveur.

```bash
npm install @ddd-ts-kit/openfga @openfga/sdk
```

`@openfga/sdk` (0.9.7, le client officiel) est une dépendance *peer* optionnelle, importée par le
seul point d'entrée `/sdk`. Le point d'entrée principal accepte tout client conforme à
`OpenFgaApi`, le sous-ensemble du client officiel qu'appellent les adaptateurs.

![Les trois fonctions du package dans une application : les cas d'usage interrogent le port Authorizer, que OpenFgaAuthorizer implémente avec Check et ListObjects ; un adaptateur du contexte écrit les tuples après la validation par le port RelationTupleStore, que OpenFgaRelationTupleStore implémente avec Write et Read ; le schéma de relations est la seule source du modèle, qu'authorizationModelOf génère et que ensureAuthorizationModel ou modelDrift écrivent ou comparent sur le serveur](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/openfga-place-in-an-application.fr.svg)

Le *package* remplit trois fonctions, chacun auprès d'un magasin d'un serveur OpenFGA : il décide
(`OpenFgaAuthorizer`), il tient les tuples (`OpenFgaRelationTupleStore`) et il garde le modèle du
serveur égal au schéma (`authorizationModelOf`, `ensureAuthorizationModel`, `modelDrift`). Les
gestionnaires (handlers) ne l'importent jamais : ils dépendent des ports de `@ddd-ts-kit/auth`, et
la plateforme lie ces adaptateurs à ces ports, exactement comme elle lie `RelationBasedAuthorizer`
et un magasin de tuples dans votre propre base de données.

## Le modèle, à partir du schéma

Le schéma est celui qu'évalue `RelationBasedAuthorizer` dans le processus : des types, les
relations qu'un tuple peut porter, et les permissions qui en dérivent. `authorizationModelOf` le
transforme en corps de `WriteAuthorizationModel` (schéma 1.1). Voici un schéma simplifié, inspiré
de celui de l'application d'exemple :

<!-- checked sample -->
```ts
import { defineSchema, from, union } from '@ddd-ts-kit/auth/rebac';
import { authorizationModelOf } from '@ddd-ts-kit/openfga';

// Qui est quoi pour quel élément : un cabinet a des responsables, un agenda son titulaire et ses assistants.
export const relationshipSchema = defineSchema({
  user: {},
  practice: { relations: { manager: ['user'] }, permissions: { manage: union('manager') } },
  calendar: {
    relations: { holder: ['user'], assistant: ['user'], practice: ['practice'] },
    permissions: { run: union('holder', 'assistant', from('practice', 'manage')) },
  },
  appointment: {
    relations: { patient: ['user'], calendar: ['calendar'] },
    permissions: { change: union('patient', from('calendar', 'run')) },
  },
});

// { schema_version: '1.1', type_definitions: [user, practice, calendar, appointment] }
export const model = authorizationModelOf(relationshipSchema);
```

Le modèle généré décide comme celui-ci, écrit dans le langage de modélisation d'OpenFGA (pour la
lecture seulement : le *package* écrit la forme JSON, et personne n'écrit ce texte à la main) :

```text
model
  schema 1.1

type user

type practice
  relations
    define manager: [user]
    define manage: manager

type calendar
  relations
    define holder: [user]
    define assistant: [user]
    define practice: [practice]
    define run: holder or assistant or manage from practice

type appointment
  relations
    define patient: [user]
    define calendar: [calendar]
    define change: patient or run from calendar
```

| Schéma de `@ddd-ts-kit/auth/rebac` | OpenFGA |
|---|---|
| une relation et les sujets qu'elle énumère : `editor: ['user', 'group#member']` | une relation directement attribuable (`this`) avec `directly_related_user_types` |
| un nom dans une réécriture : `union('owner', 'editor')` | un *userset* calculé (computed userset) |
| `union(...)`, `intersection(...)` | `union`, `intersection` |
| `exclusion(base, subtract)` | `difference` |
| `from('parent', 'edit')` | un *tuple to userset* |

`ensureAuthorizationModel(client, schema)` écrit le modèle généré quand le dernier modèle du
magasin en diffère, et renvoie l'identifiant en vigueur et les différences (OpenFGA garde chaque
modèle ; les vérifications utilisent le dernier, sauf si un client en épingle un). Exécutez-le là
où l'application est déployée ou démarre :

<!-- checked sample -->
```ts
import type { Schema } from '@ddd-ts-kit/auth/rebac';
import { ensureAuthorizationModel } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

declare const relationshipSchema: Schema;
declare const config: { readonly openfga: { readonly url: string; readonly storeId: string } };

const client = openFgaClient({ apiUrl: config.openfga.url, storeId: config.openfga.storeId });

// La première exécution écrit le modèle ; les suivantes n'écrivent rien tant que le schéma ne change pas.
const { modelId, changes } = await ensureAuthorizationModel(client, relationshipSchema);

console.log(`authorization model ${modelId}`, changes);
```

`modelDrift(authorizationModelOf(schema), served)` ne fait que comparer : une ligne par type ou
par `type#relation` manquant, en trop ou modifié, et rien quand les deux décident de la même
façon. Une étape du *pipeline* lit le dernier modèle du magasin et échoue sur la moindre ligne,
si bien que le modèle n'est jamais modifié à la main à côté du schéma :

<!-- checked sample -->
```ts
import type { Schema } from '@ddd-ts-kit/auth/rebac';
import { authorizationModelOf, modelDrift, type OpenFgaApi } from '@ddd-ts-kit/openfga';

declare const client: OpenFgaApi;
declare const relationshipSchema: Schema;

const { authorization_model: served } = await client.readLatestAuthorizationModel();
const drift = modelDrift(authorizationModelOf(relationshipSchema), served);

if (drift.length > 0) {
  console.error(drift.join('\n'));
  process.exitCode = 1;
}
```

Exécuté contre un magasin qui détient encore le modèle d'un schéma sans assistants, il affiche :

```text
calendar#assistant is in the schema, not in the store: this [user]
calendar#run differs: the schema says union(holder, assistant, from(practice, manage)) [], the store union(holder, from(practice, manage)) []
```

## Le magasin et l'*authorizer*

Dans la racine de composition, un seul client lié à un seul magasin sert les deux adaptateurs. La
correspondance (`mapping`) dit, par type de ressource, quelle relation du modèle représente
chaque permission du kit, comme pour `RelationBasedAuthorizer` :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import type { PermissionMapping, Schema } from '@ddd-ts-kit/auth/rebac';
import { OpenFgaAuthorizer, OpenFgaRelationTupleStore } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

declare const relationshipSchema: Schema;
declare const config: { readonly openfga: { readonly url: string; readonly storeId: string } };

export const schedulingPermissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Cancel an appointment' },
});

// Annuler un rendez-vous, c'est détenir la relation `change` sur lui.
const mapping: PermissionMapping = {
  appointment: { [schedulingPermissions['appointment.cancel'].id]: 'change' },
};

const client = openFgaClient({ apiUrl: config.openfga.url, storeId: config.openfga.storeId });

// Les deux mêmes ports que l'authorizer dans le processus et qu'un magasin de tuples dans votre base.
export const tuples = new OpenFgaRelationTupleStore(client, relationshipSchema);
export const authorizer = new OpenFgaAuthorizer({ client, mapping, listObjectsLimit: 1000 });
```

- `OpenFgaRelationTupleStore` passe `relationTupleStoreContract`, comme le magasin PostgreSQL :
  écrire deux fois un tuple et supprimer un tuple absent ne changent rien (les options de conflit
  d'OpenFGA 1.10 et des versions suivantes), les écritures et les suppressions vont par 100, les
  lectures suivent chaque page. Une lecture par sujet fait une lecture par relation du schéma qui
  accepte la sorte du sujet, puisqu'OpenFGA lit par utilisateur au sein d'un seul type d'objet.
- `OpenFgaAuthorizer` passe `authorizerContract`, avec la correspondance et les codes de refus de
  `RelationBasedAuthorizer` (`ANONYMOUS`, `RESOURCE_REQUIRED`, `UNMAPPED_PERMISSION`,
  `NO_RELATION`) : `Check` décide, `ListObjects` donne le périmètre d'une recherche
  (`{ kind: 'ids' }`). Un projet passe de l'un à l'autre par la liaison, rien d'autre ne change.

![À gauche, check : un acteur anonyme est refusé avec ANONYMOUS, une vérification sans ressource avec RESOURCE_REQUIRED, une permission sans relation associée avec UNMAPPED_PERMISSION, tous avant le moindre appel ; sinon Check sur le serveur renvoie allowed ou NO_RELATION. À droite, listAccessible : un acteur anonyme ou une permission sans relation associée donne le périmètre none ; sinon ListObjects, refusé avec ReverseExpansionLimitError quand la réponse atteint listObjectsLimit, et sinon le périmètre ids](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/openfga-authorizer-decisions.fr.svg)

Ce que reçoivent le *middleware* d'autorisation et un gestionnaire de recherche, avec les tuples
de l'exemple (`ada` assiste l'agenda du Dr Grace, qui contient le rendez-vous 42) :

<!-- checked sample -->
```ts
import type { Permission } from '@ddd-ts-kit/auth';
import type { Actor } from '@ddd-ts-kit/kernel';
import type { OpenFgaAuthorizer, OpenFgaRelationTupleStore } from '@ddd-ts-kit/openfga';

declare const tuples: OpenFgaRelationTupleStore;
declare const authorizer: OpenFgaAuthorizer;
declare const cancel: Permission;

await tuples.write([
  { object: 'calendar:dr-grace', relation: 'assistant', subject: 'user:ada' },
  { object: 'appointment:42', relation: 'calendar', subject: 'calendar:dr-grace' },
]);

const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

// Check user:ada change appointment:42 : { allowed: true }
export const decision = await authorizer.check({
  actor: ada,
  permission: cancel,
  resource: { type: 'appointment', id: '42' },
});

// ListObjects user:ada change appointment : { kind: 'ids', ids: ['42'] }, les identifiants que la recherche peut lire
export const scope = await authorizer.listAccessible({ actor: ada, permission: cancel, resourceType: 'appointment' });
```

**Les limites de `ListObjects`.** Le serveur renvoie au plus `OPENFGA_LIST_OBJECTS_MAX_RESULTS`
objets (1000 par défaut) et s'arrête à `OPENFGA_LIST_OBJECTS_DEADLINE` (3 secondes par défaut),
et dans les deux cas renvoie les objets trouvés jusque-là **sans erreur**. Une recherche
restreinte par une liste coupée perdrait des éléments en silence : `OpenFgaAuthorizer` refuse
donc une réponse aussi longue que `listObjectsLimit` (1000 par défaut : réglez-le sur la valeur du
serveur) avec `ReverseExpansionLimitError`, comme le fait l'*authorizer* dans le processus au-delà
de sa propre limite. Une liste coupée par le délai ne se distingue pas d'une liste complète par
sa réponse : donnez au serveur un délai supérieur au listage le plus lent que vous attendez, et
surveillez sa latence. Quand les listes sont aussi longues, restreignez-les d'abord (une
projection des identifiants accessibles, un parent plus large comme la clinique) plutôt que de
relever les limites.

**Une écriture est un appel à un service.** Elle ne rejoint pas la transaction de l'unité de
travail : un agrégat peut être validé sans son tuple, ou un tuple être écrit pour un agrégat dont
la transaction a été annulée. Écrivez les tuples après la validation (commit), jamais depuis la
transaction de la commande, et décidez de ce que voit une requête pendant la courte fenêtre
où l'agrégat existe sans sa relation :

```ts
// À éviter : un gestionnaire de la phase par défaut (before-commit) s'exécute dans la transaction,
// si bien qu'une annulation après lui laisse sur le serveur un tuple pour un rendez-vous qui n'existe pas.
@DomainEventHandler(AppointmentBooked)
export class RelationshipsOnAppointmentBooked { /* ... */ }
```

<!-- checked sample -->
```ts
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

export class AppointmentBooked implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.booked';

  readonly name = AppointmentBooked.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: { readonly calendarId: string; readonly patientId: string },
  ) {}
}

// Le port du contexte, dans ses propres mots ; son adaptateur écrit les tuples dans OpenFgaRelationTupleStore.
export abstract class SchedulingRelationships {
  abstract recordAppointment(appointment: { appointmentId: string; calendarId: string; patientId: string }): Promise<void>;
}

// Écrire : après la validation, jamais quand la transaction a été annulée.
@DomainEventHandler(AppointmentBooked, { phase: 'after-commit' })
export class RelationshipsOnAppointmentBooked implements DomainEventHandler<AppointmentBooked> {
  constructor(private readonly relationships: SchedulingRelationships) {}

  async handle(event: AppointmentBooked): Promise<void> {
    await this.relationships.recordAppointment({ appointmentId: event.aggregateId, ...event.booking });
  }
}
```

Un gestionnaire de phase `after-commit` s'exécute **au plus une fois** : un arrêt brutal entre la
validation et son exécution, ou un serveur qui ne répond pas, perd le tuple, et son échec est
seulement signalé. Un tuple qui ne doit pas être perdu passe par l'outbox : publiez un événement
d'intégration avec la modification, et écrivez le tuple depuis son consommateur, à qui
l'événement est livré au moins une fois et qui est relancé jusqu'à ce qu'il réussisse. Le magasin
est idempotent, si bien qu'une livraison répétée ne change rien.

## Tester

Les *specs* de ce *package* exécutent les deux suites de contrat contre un double en mémoire des
points d'accès des tuples, et contre un vrai serveur quand `DDD_TS_KIT_OPENFGA_URL` est défini :
le *job* d'intégration du dépôt démarre `openfga/openfga` v1.22.0, épinglé par *digest*. Un projet
soumet ses propres adaptateurs aux mêmes suites, chaque test sur un magasin à lui (`createStore`,
puis `ensureAuthorizationModel`). Les tuples qu'écrit le contrat du magasin portent sur des
documents et des groupes (`document:1#editor@group:eng#member`, `document:1#parent@group:eng`) :
le magasin sur lequel il s'exécute détient un modèle qui les décrit.

<!-- checked sample -->
```ts
import { OpenFgaClient } from '@openfga/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineSchema } from '@ddd-ts-kit/auth/rebac';
import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { ensureAuthorizationModel, OpenFgaRelationTupleStore, type OpenFgaApi } from '@ddd-ts-kit/openfga';
import { openFgaClient } from '@ddd-ts-kit/openfga/sdk';

const OPENFGA_URL = process.env['OPENFGA_TEST_URL'] ?? '';

// Les types et les relations des tuples qu'écrit le contrat.
const contractSchema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  document: {
    relations: { editor: ['user', 'group#member'], viewer: ['user', 'group#member'], parent: ['group'] },
  },
});

let stores = 0;

// Un magasin à lui par test, qui détient le modèle du schéma : aucun test ne voit les tuples d'un autre.
async function freshStore(): Promise<OpenFgaApi> {
  const admin = new OpenFgaClient({ apiUrl: OPENFGA_URL });
  const { id: storeId } = await admin.createStore({ name: `contract-${process.pid}-${(stores += 1)}` });
  const client = openFgaClient({ apiUrl: OPENFGA_URL, storeId });

  await ensureAuthorizationModel(client, contractSchema);

  return client;
}

// Ignoré sans serveur, comme les specs du package.
relationTupleStoreContract(
  { describe: describe.runIf(OPENFGA_URL !== ''), it, expect, beforeEach, afterEach },
  {
    name: 'OpenFgaRelationTupleStore on an OpenFGA server',
    create: async () => new OpenFgaRelationTupleStore(await freshStore(), contractSchema),
  },
);
```

## Limites

- Aucun jeton de cohérence n'est transmis : une vérification utilise la préférence par défaut du
  serveur (`MINIMIZE_LATENCY`), si bien qu'un tuple tout juste écrit peut ne pas être vu tout de
  suite par chaque réplique.
- Pas de tuples conditionnels (les conditions d'OpenFGA) : le schéma du kit n'a pas de *caveats*
  non plus.
- Le sujet d'un acteur est `<type>:<id>` ; un identifiant qui contient un caractère qu'OpenFGA
  refuse dans un identifiant d'objet demande `subjectOf`.
- `expand` de `RelationBasedAuthorizer` n'a pas d'équivalent ici : utilisez l'API `Expand`
  d'OpenFGA pour le débogage.

## Voir aussi

- [Moteurs d'autorisation](../../docs/tools/authorization-engines.fr.md) : le magasin de tuples
  PostgreSQL ou OpenFGA, et quand choisir lequel
- [Choisir le contrôle d'accès](../../docs/guides/choosing-access-control.fr.md)
- [Événements du domaine et événements d'intégration](../../docs/concepts/domain-and-integration-events.fr.md) :
  les phases d'un gestionnaire d'événement du domaine, et ce qui atteint un autre processus au
  moins une fois
