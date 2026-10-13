[English](README.md) · **Français**
<!-- translation-of: README.md sha256:2ca1f2a6664a4f13 -->

# @ddd-ts-kit/audit

Un journal d'audit (audit trail) inviolable de manière démontrable, dans lequel les cas d'usage
n'écrivent jamais. Qui a été autorisé ou refusé à faire quoi, quelle commande s'est exécutée et
comment elle s'est terminée, quel événement d'intégration est survenu : chaque fait est une
entrée en ajout seul, chaînée par hachage à celle qui la précède, enregistrée par un *middleware*
de bus, le *hook* d'autorisation, le *pipeline* HTTP quand une garde refuse, ou un abonnement aux
événements. Aucun gestionnaire (handler) et aucun agrégat ne contient d'appel d'audit.

```
npm i @ddd-ts-kit/audit
npm i knex pg          # seulement pour @ddd-ts-kit/audit/knex
npm i drizzle-orm      # seulement pour @ddd-ts-kit/audit/drizzle
```

| Point d'entrée | Contient | Importe |
|---|---|---|
| `@ddd-ts-kit/audit` | `InMemoryAuditTrail`, les sources (`auditDecisions`, `auditGuardRefusals`, `auditMiddleware`, `auditIntegrationEvents`) et `auditRecordOf`, `auditedFields`, `auditedProjection` et `masked`, le port `AuditMasker` et `hmacMasker`, `verifyChain`, `TenantAuditReader`, les primitives de la chaîne (`canonicalize`, `hashOf`, `GENESIS_HASH`, `chainOfTenant`) ; réexportés depuis le noyau : `AuditEntry`, les ports `AuditTrail` et `AuditReader` et les types qu'ils nomment | le noyau seulement |
| `@ddd-ts-kit/audit/knex` | `KnexAuditTrail`, `createAuditTables`, `dropAuditTables` | `knex` (pair optionnel) |
| `@ddd-ts-kit/audit/drizzle` | `DrizzleAuditTrail`, `auditEntriesTable`, `auditChainsTable`, `auditGuardStatements` | `drizzle-orm` (pair optionnel) |
| `@ddd-ts-kit/audit/testing` | `auditTrailContract` | `@ddd-ts-kit/testing` (pair optionnel), le *runner* que vous passez |

## L'idée

Un journal d'audit répond à « qui a fait quoi, quand, et était-ce autorisé » à quelqu'un qui ne
fait pas confiance à l'application : un auditeur, un client, un régulateur. Trois conséquences :

- **Il est alimenté depuis l'extérieur des cas d'usage.** Un gestionnaire qui doit penser à
  appeler l'audit l'oubliera, et un agrégat qui l'appelle a cessé d'être un modèle. Les décisions
  d'autorisation, les refus à la frontière HTTP, les commandes et les événements d'intégration
  passent déjà par quelques endroits (le *middleware* d'autorisation, le *pipeline* HTTP, les bus,
  les abonnements aux événements) ; c'est là que les entrées sont écrites.
- **Il est en ajout seul, et chaque entrée scelle la précédente.** Modifier, supprimer ou
  réordonner une entrée rompt la chaîne à un endroit que `verifyChain` nomme.
- **Il contient des identifiants et des codes, jamais de contenu.** Même règle que pour le traçage
  et le *package* des aspects : des noms de classes, des identifiants de permissions, des codes
  d'erreur ; jamais d'arguments, de résultats ni de messages. Une valeur n'entre que si le projet
  la déclare, champ par champ.

Ce n'est pas un journal applicatif (les journaux sont échantillonnés, tournés et perdus), pas de
l'*event sourcing* (il ne reconstruit pas d'état) et pas l'`AuditStamp` du noyau (`createdBy`,
`updatedBy` : le dernier auteur d'une ligne, pas l'historique).

![Les sources auditGuardRefusals, auditDecisions, auditMiddleware, auditIntegrationEvents et, à la main, auditRecordOf appellent le port AuditTrail ; un store (en mémoire, knex ou drizzle) l'implémente, scelle chaque enregistrement avec sa chaîne, sa séquence, le hachage précédent et son hachage, et écrit dans PostgreSQL derrière des triggers d'ajout seul ; le même store implémente AuditReader, que lisent le gestionnaire de SearchAuditEntriesQuery et verifyChain ; le scellement remet des points de contrôle à un endroit où l'application ne peut pas écrire](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/audit-place-in-an-application.fr.svg)

Le schéma est la carte de cette page : [l'entrée](#lentrée) et son hachage, les
[sources](#brancher-les-sources), le [caviardage](#caviardage), la
[vérification](#vérification-et-ancrage), les [stores](#stores) et la
[recherche](#interroger-le-journal).

## Un premier journal, en mémoire

Tout à la fois, dans un seul fichier qui s'exécute : un bus de commandes avec le *middleware*
d'audit, la déclaration de ce que porte l'entrée d'une commande, deux commandes, puis la
vérification de la chaîne et ce qu'une entrée modifiée lui fait. `InMemoryAuditTrail` est le
*fake* des tests ; en production, un store SQL prend sa place et rien d'autre ne change.

<!-- checked sample -->
```ts
import {
  AuthorizedCommand,
  FixedClock,
  FixedExecutionScope,
  InMemoryCommandBus,
  SequentialIdGenerator,
  executionContext,
  type Actor,
} from '@ddd-ts-kit/kernel';
import { InMemoryAuditTrail, auditMiddleware, auditedFields, hmacMasker, masked, verifyChain } from '@ddd-ts-kit/audit';

class RescheduleAppointmentCommand extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly startsAt: Date,
    readonly patientEmail: string,
    readonly note: string,
  ) {
    super(actor);
  }
}

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['practitioner'], attributes: {} };

// Dans une application, la frontière HTTP ouvre cette portée pour chaque requête HTTP.
const scope = new FixedExecutionScope(executionContext({ correlationId: 'request-1', actor: ada, origin: 'http' }));
const trail = new InMemoryAuditTrail();

const commands = new InMemoryCommandBus()
  .use(
    auditMiddleware(trail, {
      scope,
      clock: new FixedClock(new Date('2026-03-01T10:00:00.000Z')),
      ids: new SequentialIdGenerator('audit'),
      masker: hmacMasker('a secret of the configuration', { keyId: 'k1' }),
      fields: [
        auditedFields(RescheduleAppointmentCommand, ['startsAt', masked('patientEmail')], {
          resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
          context: 'scheduling',
        }),
      ],
    }),
  )
  .register(RescheduleAppointmentCommand, { execute: async () => undefined }); // le gestionnaire : aucun appel d'audit

const startsAt = new Date('2026-03-04T09:30:00.000Z');
await commands.execute(new RescheduleAppointmentCommand(ada, 'apt-1', startsAt, 'lin@example.org', 'Family matter'));
await commands.execute(new RescheduleAppointmentCommand(ada, 'apt-1', startsAt, 'lin@example.org', 'Again'));

// trail.entries[0] :
// { id: 'audit-1', chain: 'tenant:acme', sequence: 1, occurredAt: 2026-03-01T10:00:00.000Z,
//   category: 'command', action: 'RescheduleAppointmentCommand', outcome: 'succeeded',
//   resource: { type: 'appointment', id: 'apt-1' }, context: 'scheduling',
//   changes: { startsAt: '2026-03-04T09:30:00.000Z', patientEmail: { masked: 'k1:f3997a...' } },
//   actor: { id: 'ada', type: 'user', tenantId: 'acme' }, tenantId: 'acme',
//   correlationId: 'request-1', origin: 'http', extensions: {},
//   previousHash: '0000...0000', hash: 'f65501...' }
// Pas de `note` : il n'a pas été déclaré, il n'a donc jamais été lu.

await verifyChain(trail.entries); // { valid: true, checked: 2 }

// Quelqu'un déplace le rendez-vous d'une heure, dans le journal lui-même :
const first = trail.entries[0];

if (first !== undefined) {
  trail.entries[0] = { ...first, changes: { ...first.changes, startsAt: '2026-03-04T10:30:00.000Z' } };
}

await verifyChain(trail.entries);
// { valid: false, checked: 0,
//   break: { kind: 'altered-content', chain: 'tenant:acme', position: 0, sequence: 1, entryId: 'audit-1' } }
```

Ada travaille dans le *tenant* `acme` : ses entrées vont donc dans la chaîne `tenant:acme` ; la
seconde porte le hachage de la première comme `previousHash`. La suite de cette page prend chaque
pièce tour à tour.

## L'entrée

L'entrée est un type standard du noyau, et les deux ports, `AuditTrail` et `AuditReader`, sont
des classes abstraites du noyau, si bien que le code qui enregistre ou qui liste ne dépend que du
noyau. Une classe de port est aussi la clé d'une liaison : il n'y a pas de jeton à côté. Ce
*package* les réexporte, et contient tout ce qui rend un journal inviolable de manière
démontrable : la chaîne, les sources, le caviardage, la vérification et les stores.

```ts
interface AuditEntry {
  id: string;
  chain: string;             // 'tenant:<id>', ou 'global' pour un travail qui ne nomme aucun tenant
  sequence: number;          // position dans la chaîne : 1, 2, 3, sans trou
  occurredAt: Date;
  category: 'authorization' | 'command' | 'query' | 'integration-event' | 'authentication' | 'data-access' | string;
  action: string;            // un identifiant de permission, un nom de commande, un type d'événement
  outcome: 'allowed' | 'denied' | 'succeeded' | 'failed';
  reason?: string;           // un code stable : NO_MATCHING_ROLE, le code d'une DomainError
  actor: { id: string; type: ActorType | 'unknown'; tenantId?: string };
  tenantId?: string;         // le tenant du travail en cours
  impersonatedBy?: string;
  sessionId?: string;
  resource?: { type: string; id: string };
  context?: string;          // contexte délimité
  correlationId: string;
  causationId?: string;
  origin: ExecutionOrigin;   // 'http', 'event', 'schedule', 'cli', ...
  changes?: Record<string, string | number | boolean | null | { masked: string }>;
  extensions: AuditEntryExtensionValues;
  previousHash: string;
  hash: string;
}
```

Une source remet un `AuditRecord` (l'entrée sans `chain`, `sequence`, `previousHash` ni `hash`)
au journal, qui le scelle. L'acteur, le *tenant*, la session, l'emprunt d'identité
(impersonation), la corrélation, la causalité et l'origine sont lus dans l'`ExecutionScope` du
noyau, jamais transmis à travers un cas d'usage.

Un projet ajoute ses propres champs par fusion de déclarations, comme pour la `Session` du noyau.
Ils vivent sous `extensions`, sont optionnels à la lecture, et doivent être du JSON (une `Date` ou
une classe se lit comme `never`), puisqu'ils sont hachés et stockés tels quels. L'interface est
celle du noyau : augmentez `@ddd-ts-kit/kernel`, à côté des autres extensions du projet
(augmenter `@ddd-ts-kit/audit` fonctionne encore) :

```ts
declare module '@ddd-ts-kit/kernel' {
  interface AuditEntryExtensions {
    readonly region: 'eu' | 'us';
  }
}
```

### Une chaîne par tenant

Chaque entrée appartient à une chaîne : `tenant:<id>` quand le travail en cours nomme un
*tenant*, `global` sinon (`chainOfTenant`). Les raisons : un *tenant* peut être vérifié, exporté
et remis sans les entrées des autres ; les ajouts à une chaîne sont sérialisés, si bien qu'une
seule chaîne pour tout ferait attendre chaque commande du système sur le même verrou ; et un
*tenant* qui part laisse des chaînes qui se vérifient encore. Le prix : l'ordre entre les entrées
de deux *tenants* n'est donné que par `occurredAt`, pas prouvé par un hachage. Passez `chainOf` à
un journal pour en décider autrement (une chaîne par contexte délimité, une chaîne unique pour un
petit système).

### Le hachage

`hash` est le SHA-256, en hexadécimal minuscule, de la forme canonique de l'entrée sans `hash` :
`previousHash`, `chain` et `sequence` font donc partie de ce qui est scellé. La forme canonique
(`canonicalize`) est faite pour être recalculée par n'importe quel programme, dans n'importe quel
langage :

- du JSON sans espaces, encodé en UTF-8 ;
- les clés de chaque objet triées par unité de code UTF-16, à toutes les profondeurs ;
- une propriété dont la valeur est `undefined` omise ;
- `occurredAt` écrit en ISO 8601 UTC avec les millisecondes (`2026-03-01T10:00:00.000Z`) ;
- les chaînes et les nombres tels que `JSON.stringify` les écrit.

La première entrée d'une chaîne a un `previousHash` égal à `GENESIS_HASH` (64 zéros).

## Brancher les sources

Tout se passe dans la racine de composition. D'abord assemblées à la main ; les mêmes pièces
liées dans une application de `@ddd-ts-kit/di` viennent
[après les sources](#dans-une-application-de-ddd-ts-kitdi). L'ordre des *middlewares* de
commandes compte :

```ts
// src/platform/audit/audit.ts
import { unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { authorizationMiddleware } from '@ddd-ts-kit/auth';
import { subscribeAll } from '@ddd-ts-kit/events';
import { auditDecisions, auditIntegrationEvents, auditMiddleware, auditedFields, hmacMasker, masked } from '@ddd-ts-kit/audit';
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';

const trail = new KnexAuditTrail(unitOfWork, { schema: 'audit' }); // tout ce qui a `executor()` : l'unité de travail de @ddd-ts-kit/knex, ou son contexte
const source = { scope, clock, ids };

commandBus
  // 1. qui a le droit : refusé avant qu'une transaction ne s'ouvre
  .use(authorizationMiddleware({ authorizer, map, onDecision: auditDecisions(trail, { ...source, sensitivePermissions: ['records:medical-file.read'] }) }))
  // 2. ce qui s'est exécuté et comment cela s'est terminé : ouvre lui-même l'unité de travail
  .use(auditMiddleware(trail, {
    ...source,
    unitOfWork,
    masker: hmacMasker(config.auditMaskingSecret, { keyId: 'k1' }),
    fields: [auditedFields(RescheduleAppointmentCommand, ['status', 'startsAt', masked('patientEmail')], {
      resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
      context: 'scheduling',
    })],
  }))
  // 3. rejoint la transaction ouverte par 2
  .use(unitOfWorkMiddleware(unitOfWork));

// 4. ce qui est survenu entre les contextes
subscribeAll(eventBus, auditIntegrationEvents(trail, { registry, clock, ids, processed, unitOfWork }));
```

### a. Décisions d'autorisation

`auditDecisions(trail, options)` renvoie la fonction `onDecision` du *middleware* d'autorisation
de `@ddd-ts-kit/auth`. Les types correspondent structurellement : ce *package* ne dépend pas du
*package* auth. Chaque entrée a la catégorie `authorization`, l'identifiant de la permission comme
`action`, `allowed` ou `denied` comme résultat, le code du refus comme `reason`, la ressource de
la décision.

Ce qui est enregistré par défaut :

| Décision | Enregistrée |
|---|---|
| refusée, commande ou requête | toujours |
| autorisée, tout ce qui n'est pas une lecture | toujours |
| lecture autorisée d'une permission listée dans `sensitivePermissions` | toujours |
| toute autre lecture autorisée | non |

Enregistrer chaque liste et chaque consultation de page noie le journal et le rend coûteux à
conserver : les lectures autorisées enregistrées sont donc celles que vous choisissez.
`allowedReads: 'all'` les enregistre toutes, `allowedReads: { sample: 0.01 }` une sur cent. Une
lecture est, par défaut, une décision dont le `kind` est `query` : le *middleware* le tient du bus
qui a porté le message, quel que soit le nom de la classe. Une décision prise hors d'un bus ne
nomme aucun genre et est enregistrée. Passez `isRead` pour en décider autrement.

Quand la décision concerne un autre acteur que celui du contexte d'exécution (un consommateur qui
envoie une commande pour le compte d'un utilisateur), l'entrée nomme l'acteur de la décision avec
le type `unknown` : son type et son *tenant* ne font pas partie de ce que reçoit le *hook*.

### a'. Refus à la frontière

Une requête HTTP qu'une garde refuse (`HasRole`, `HasScope`, `TenantMember`, un *tenant* auquel
l'appelant n'appartient pas) n'atteint jamais un cas d'usage : le *middleware* d'autorisation ne la
voit donc pas. Le *pipeline* HTTP la signale à `onGuardRefusal`, et
`auditGuardRefusals(trail, { clock, ids })` l'enregistre : catégorie `authorization`, action
`http:<operationId>`, résultat `denied`, le code du refus comme `reason` (`FORBIDDEN`,
`UNAUTHORIZED`), et l'acteur, la session, le *tenant* et la corrélation de la requête HTTP. Un
appelant sans identifiants n'est pas enregistré : il n'y a personne à qui demander des comptes, le
*tenant* auquel il s'est adressé est son propre choix, et l'enregistrer laisserait un trafic non
authentifié écrire dans le journal (et ouvrir des chaînes de hachage) sans limite ; ces refus
relèvent du journal d'accès et de la limitation de débit. Un refus enregistré est dans le *tenant*
des identifiants de l'appelant. Une garde qui échoue au lieu de refuser (une recherche qui a levé
une exception, pas une `DomainError`) n'est pas signalée.

```ts
mountExpress(app, routes, { ...boundary, onGuardRefusal: auditGuardRefusals(trail, { clock, ids }) });
```

### b. Commandes, et l'unité de travail

`auditMiddleware` enregistre chaque commande avec le résultat `succeeded` ou `failed`, et le
`code` de la `DomainError` comme raison. Un échec qui n'est pas une `DomainError` est enregistré
comme `UNEXPECTED_ERROR` : ni sa classe ni son message n'entrent dans le journal, ils citent des
données. `queries: [ReadMedicalFileQuery]` ou `queries: 'all'` enregistre aussi les requêtes.

Deux exigences tirent en sens opposés : l'entrée d'une commande **en échec** doit survivre à
l'annulation (rollback), et l'entrée d'une commande **réussie** ne doit pas exister si sa
transaction n'a pas été validée. Un *middleware* placé dans l'unité de travail perd la première,
un *middleware* placé à l'extérieur perd la seconde (un arrêt brutal entre la validation et
l'enregistrement, ou une entrée écrite pour une validation qui a ensuite été refusée). D'où
l'agencement : le *middleware* est installé **avant** `unitOfWorkMiddleware` et reçoit l'unité de
travail.

- Il ouvre lui-même l'unité de travail ; `unitOfWorkMiddleware`, et tout `run` imbriqué,
  rejoignent cette transaction.
- Après le retour du gestionnaire, il écrit l'entrée `succeeded` dans cette transaction. L'entrée
  et le changement d'état sont validés ensemble, ou aucun des deux n'existe. Si l'entrée ne peut
  pas être écrite, la commande échoue et est annulée : aucun changement d'état sans sa trace.
- Quand le gestionnaire lève une erreur, ou que la validation est refusée, la transaction n'est
  plus ; le *middleware* écrit alors l'entrée `failed` hors de celle-ci, et relève l'échec du cas
  d'usage. Si cette écriture échoue elle aussi, l'appelant reçoit tout de même l'échec du cas
  d'usage, et `onLostRecord` en est informé.

![CancelAppointment passe d'abord par l'autorisation : refusée, elle laisse une entrée authorization denied et n'ouvre aucune transaction ; autorisée, le middleware d'audit ouvre la transaction et le gestionnaire s'y exécute ; en cas de succès, l'entrée succeeded est écrite dans la même transaction et validée avec le changement, ou aucun des deux n'existe ; en cas d'échec, la transaction est annulée, puis l'entrée failed est écrite hors de celle-ci avec le code de l'erreur](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/audit-trail-transaction.fr.svg)

Sans `unitOfWork` (pas de base de données, le journal en mémoire), le *middleware* enregistre
après le gestionnaire. Enregistrer par l'outbox serait aussi atomique pour les succès, mais une
ligne d'outbox partage le sort de la transaction : elle ne peut donc pas porter les échecs, et ne
résout que la moitié du problème.

Placez le *middleware* d'autorisation avant celui-ci. Une commande refusée laisse alors une seule
entrée `authorization denied` et n'ouvre aucune transaction ; dans l'ordre inverse, elle
laisserait aussi une entrée `command failed` avec la raison `FORBIDDEN`.

### c. Événements d'intégration

`auditIntegrationEvents(trail, options)` renvoie un abonnement par type d'événement du registre, à
remettre à `subscribeAll`. Il ne lit que l'enveloppe (type, id, corrélation), jamais le *payload* :
l'entrée dit que `billing.invoice.issued` est survenu, avec l'id de l'événement comme
`causationId` et la corrélation de l'enveloppe. La livraison se fait au moins une fois : il
déduplique donc par id d'événement grâce au `ProcessedEventStore` qu'il reçoit, sous le nom de
consommateur `audit` ; avec `unitOfWork`, la marque et l'entrée sont validées ensemble.

### d. À la main, l'exception

`AuditTrail.record` reste disponible pour ce qu'aucune des sources ne peut voir : une entrée
`data-access` écrite par l'infrastructure, comme un export. `auditRecordOf` remplit tout ce que la
portée connaît :

```ts
// infrastructure/external/appointment-export.ts
await trail.record(auditRecordOf({ scope, clock, ids }, {
  category: 'data-access',
  action: 'scheduling.appointments.export',
  outcome: 'succeeded',
  changes: { rows: 2000, format: 'csv' },
}));
```

C'est du code d'infrastructure. Un appel au journal dans `domain/` ou `application/` est le défaut
que ce *package* existe pour empêcher, et
[`layer/application-inward`](../eslint-plugin/docs/rules/layer-application-inward.fr.md) signale
un import de `@ddd-ts-kit/audit` dans `application/`. Ce qu'un gestionnaire est tenté d'écrire,
et ce qui le remplace :

<!-- checked sample -->
```ts
import { AuthorizedCommand, type Actor, type AuditTrail, type Clock, type ExecutionScope, type IdGenerator } from '@ddd-ts-kit/kernel';
import { auditRecordOf, auditedFields } from '@ddd-ts-kit/audit';

class CancelAppointmentCommand extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

// Au lieu de : le gestionnaire enregistre sa propre entrée. Chaque gestionnaire doit y penser, un
// échec ne laisse aucune entrée, et le cas d'usage dépend désormais de l'audit.
export class CancelAppointmentHandler {
  constructor(
    private readonly trail: AuditTrail,
    private readonly source: { scope: ExecutionScope; clock: Clock; ids: IdGenerator },
  ) {}

  async execute(command: CancelAppointmentCommand): Promise<void> {
    // ... annuler le rendez-vous ...
    await this.trail.record(
      auditRecordOf(this.source, {
        category: 'command',
        action: 'CancelAppointmentCommand',
        outcome: 'succeeded',
        resource: { type: 'appointment', id: command.appointmentId },
      }),
    );
  }
}

// Écrivez : le gestionnaire ne fait qu'annuler. Dans la racine de composition, une déclaration dit
// ce que porte l'entrée, et `auditMiddleware` enregistre chaque résultat, échecs compris, avec leur code.
export const cancelAppointmentAudit = auditedFields(CancelAppointmentCommand, [], {
  resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
  context: 'scheduling',
});
```

### Dans une application de `@ddd-ts-kit/di`

Le store est lié aux deux ports, et le *masker* au sien, chacun sous sa classe :

```ts
// src/platform/audit/audit.module.ts
import { AuditReader, AuditTrail } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '@ddd-ts-kit/di';
import { AuditMasker, hmacMasker } from '@ddd-ts-kit/audit';
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';

export const trail = new KnexAuditTrail(unitOfWork, { schema: 'audit' }); // l'unité de travail liée à `UnitOfWork` et à `KnexContext`

export const auditModule = defineContextModule({
  name: 'audit',
  register(builder) {
    builder.bind(AuditTrail).toValue(trail);
    builder.bind(AuditReader).toValue(trail);
    builder.bind(AuditMasker).toValue(hmacMasker(config.auditMaskingSecret, { keyId: 'k1' }));
  },
});
```

`builder.bind(AuditTrail).toClass(KnexAuditTrail, [KnexContext])` lie à la place un store avec
ses options par défaut, `KnexContext` étant le port de `@ddd-ts-kit/knex`.

Les sources sont installées là où les bus sont construits. Le bus de commandes de
`kernelModule()` exécute la garde des cas d'usage, puis l'unité de travail ; le *middleware*
d'audit doit se placer entre les deux, le bus est donc fourni par les options :

```ts
// src/main.ts
import { AuditTrail, InMemoryCommandBus, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { UseCaseGuard, createApplication, kernelModule } from '@ddd-ts-kit/di';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { AuditMasker, auditDecisions, auditMiddleware } from '@ddd-ts-kit/audit';

const source = { scope, clock, ids };

const app = createApplication({
  modules: [
    kernelModule({
      executionScope: scope,
      clock,
      ids,
      unitOfWork,
      commandBus: (resolve) =>
        new InMemoryCommandBus()
          .use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))
          .use(auditMiddleware(resolve(AuditTrail), { ...source, unitOfWork, masker: resolve(AuditMasker), fields }))
          .use(unitOfWorkMiddleware(unitOfWork)),
    }),
    auditModule,
    schedulingModule,
    authorizationModule({ authorizer, onDecision: auditDecisions(trail, { ...source, sensitivePermissions: ['records:medical-file.read'] }) }),
  ],
  authorization: 'required',
});
```

Un projet généré par la CLI avec `--audit on` (la valeur par défaut) a ce câblage sous
`src/platform/audit/` : `create-audit.ts` construit le journal et ses sources, `audit.module.ts`
lie les deux ports, abonne les événements d'intégration sous le nom de consommateur `audit` et
enregistre la requête protégée `SearchAuditEntriesQuery`, et
`src/platform/buses/create-command-bus.ts` place le *middleware* d'audit entre la garde des cas
d'usage et l'unité de travail.

Un gestionnaire ou un adaptateur qui a besoin du journal nomme le port dans ses dépendances et
reçoit le store : `[AuditReader]` pour la requête qui liste les entrées (voir
[Interroger le journal](#interroger-le-journal)), `[AuditTrail]` pour l'adaptateur
d'infrastructure qui enregistre à la main.

## Caviardage

**Par défaut, une entrée ne porte aucun *payload*.** `changes` n'existe que pour ce qui a été
déclaré :

```ts
auditedFields(RescheduleAppointmentCommand, ['status', 'startsAt', masked('patientEmail')]);
auditedProjection(ExportAppointmentsCommand, (command) => ({ plain: { format: command.options.format } }));
```

![Une RescheduleAppointmentCommand et ses cinq champs, la déclaration, et l'entrée : appointmentId devient la ressource, status est gardé tel quel, startsAt comme un instant ISO, patientEmail comme le HMAC de la valeur sous un secret, et note, du texte libre qui n'est pas listé, n'est jamais lu et ne laisse aucune trace](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/audit-redaction.fr.svg)

- Un champ qui n'est pas listé n'est jamais lu. Le compilateur refuse un nom que le message n'a
  pas.
- Une valeur n'est gardée que si c'est une chaîne, un nombre, un booléen, `null`, un bigint (sous
  forme de texte) ou une `Date` (sous forme d'instant ISO). Un objet n'est jamais stocké en
  entier : choisissez ses scalaires avec `auditedProjection`.
- `masked('patientEmail')` stocke `{ masked: '<keyId>:<hex>' }` : le HMAC-SHA-256 de la valeur
  sous un secret (`hmacMasker`). Deux entrées concernant le même email portent le même masque :
  « toutes les entrées concernant cette personne » peut donc être obtenu en masquant de nouveau
  l'email ; l'email lui-même n'y est pas, et sans le secret une supposition ne peut pas être
  vérifiée. Un simple hachage ne suffirait pas : un email ou un numéro de téléphone se devine en
  quelques secondes.
- Un champ déclaré `masked` sans *masker* est refusé à la construction du *middleware* ; une
  projection qui demande un masque sans *masker* fait échouer la commande à sa première
  utilisation.

**Ce qui ne doit jamais entrer**, déclaré ou non :

- le texte libre (un commentaire, une raison saisie par un utilisateur, le corps d'un message) :
  il contient n'importe quoi ;
- les identifiants de connexion et les jetons, les cookies de session, les clés d'API, les codes
  à usage unique, même hachés ;
- les *payloads* entiers, les corps de requêtes HTTP, les agrégats, les résultats de requêtes ;
- les messages d'erreur et les traces de pile : enregistrez le `code` ;
- les catégories particulières de données personnelles (santé, opinions, biométrie), même
  masquées, sauf si un enregistrement de décision (ADR) dit pourquoi.

### Le droit à l'effacement et une chaîne en ajout seul

Une entrée ne peut pas être supprimée sans rompre sa chaîne, et une réglementation peut exiger
que des données personnelles soient effacées. Les deux coexistent tant que la chaîne ne contient
jamais les données :

1. **Gardez les données personnelles dehors.** Un id d'acteur, un id de ressource, un
   identifiant de permission sont des identifiants. Si vos identifiants sont eux-mêmes des
   données personnelles (un email comme id d'utilisateur), corrigez cela d'abord, ou masquez-les
   à la frontière.
2. **Masquez ce que vous devez corréler.** Une valeur masquée n'est pas lisible ; elle reste liée
   à une personne pour qui détient le secret.
3. **L'effacement cryptographique (crypto-shredding) pour l'effacement.** Écrivez un *masker*
   qui dérive une clé par personne concernée (ou par *tenant*) depuis un stockage de clés, à
   l'aide du `MaskingSubject` qu'il reçoit (`actorId`, `tenantId`, `resource`). `AuditMasker` est
   un port, une classe abstraite avec la seule méthode `mask` : l'adaptateur l'`implements` et est
   lié sous ce port :

   ```ts
   // infrastructure/external/per-subject-masker.ts
   export class PerSubjectMasker implements AuditMasker {
     constructor(private readonly keys: SubjectKeys) {}

     async mask(value: AuditScalar, subject: MaskingSubject): Promise<string> {
       const key = await this.keys.keyOf(subject.resource?.id ?? subject.actorId); // créée à la première utilisation

       return hmacMasker(key.secret, { keyId: key.id }).mask(value, subject);
     }
   }

   builder.bind(AuditMasker).toClass(PerSubjectMasker, [SubjectKeys]);
   ```

   Effacer une personne, c'est supprimer sa clé : chaque masque fait avec elle devient un jeton
   d'apparence aléatoire que personne ne peut recalculer, les entrées restent, les hachages
   restent valides. Le stockage de clés devient alors le système à protéger et à sauvegarder avec
   soin ; ce *package* n'en fournit pas.

Ce qui reste après l'effacement, c'est « un acteur avec cet id opaque a fait ceci à ce moment ».
Savoir si c'est acceptable est une question juridique pour le projet, à trancher avant que la
première entrée ne soit écrite.

## Vérification et ancrage

```ts
const outcome = await verifyChain(reader, { chain: 'tenant:acme' });
// { valid: true, checked: 1842 }
// { valid: false, checked: 311, break: { kind: 'altered-content', chain: 'tenant:acme', position: 311, sequence: 312, entryId: '...' } }
```

`verifyChain(entries | reader, { chain?, from?, to?, checkpoints? })` parcourt une chaîne dans
l'ordre donné et signale le **premier** endroit où elle cesse de tenir :

| Genre | Signification |
|---|---|
| `altered-content` | l'entrée ne se hache pas en son `hash`, ne se lie pas à l'entrée qui la précède, ou contredit un point de contrôle |
| `missing-entry` | la séquence attendue n'est nulle part dans ce qui a été examiné (un trou, une tête manquante, une chaîne plus courte que `to`) |
| `reordered` | la séquence attendue existe ailleurs, ou une position apparaît deux fois |

`position` est l'indice parmi les entrées examinées de la chaîne, `sequence` la séquence qui y
était attendue. Avec des entrées (un export), chaque chaîne trouvée est vérifiée, et les entrées
ne sont jamais triées d'abord : un fichier mélangé est signalé comme tel. Avec un lecteur, `chain`
est obligatoire et la plage est lue page par page, puis tenue en mémoire : vérifiez les longues
chaînes par plages (`from`, `to`). Une plage qui commence au-dessus de 1 fait confiance à l'entrée
qui la précède.

![Quatre entrées de la chaîne tenant:acme, chacune gardant le hachage de l'entrée précédente et le sien, la première liée au hachage d'origine ; une entrée modifiée est signalée comme altered-content, une entrée supprimée comme missing-entry, deux entrées interverties comme reordered ; une chaîne réécrite en entier redevient valide : c'est donc un point de contrôle copié là où le propriétaire du journal ne peut pas écrire qui le révèle](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/audit-trail-hash-chain.fr.svg)

**Pourquoi l'ancrage.** La chaîne protège contre quiconque peut modifier quelques lignes.
Quiconque peut réécrire toute la table (un administrateur de base de données, un attaquant qui a
le rôle du propriétaire) peut recalculer chaque hachage à partir de l'entrée modifiée : le
résultat est une chaîne parfaitement valide. La seule défense est une copie de quelques hachages
là où cette personne ne peut pas écrire. `sealing` remet un point de contrôle toutes les N entrées
d'une chaîne :

```ts
new KnexAuditTrail(unitOfWork, {
  schema: 'audit',
  sealing: { every: 1000, onSeal: (checkpoint) => outbox.append([auditChainSealed.create(checkpoint, meta)]) },
});
// plus tard, contre les points de contrôle gardés ailleurs :
await verifyChain(reader, { chain, checkpoints });
```

Le *hook* s'exécute quand l'entrée est écrite, dans l'unité de travail quand il y en a une.
Ajouter là le point de contrôle à l'outbox fait qu'il ne part que si l'entrée est validée ; un
*hook* qui appelle directement un service distant peut ancrer une entrée dont la transaction est
annulée ensuite. L'endroit où vont les points de contrôle est le choix du projet : une autre base
de données sous un autre rôle, un stockage d'objets avec verrou de rétention, un journal de
transparence, un horodatage signé. Une fin tronquée (les dernières entrées supprimées) ne se voit
qu'en comparant avec un point de contrôle ultérieur ou en demandant `to`.

## Stores

`InMemoryAuditTrail` implémente les deux ports : le *fake* des tests (`entries` est le store, pour
vérifier et pour altérer) et de quoi suffire à une application sans base de données.

Les stores SQL sont pour **PostgreSQL**. Ils écrivent sur l'exécuteur de l'unité de travail
(`KnexContext.executor()`, `DrizzleContext.executor()`) : dans une transaction, l'entrée partage
son sort ; hors transaction, elle est écrite immédiatement dans une transaction à elle.

```ts
// knex : une migration du projet
import { createAuditTables, dropAuditTables } from '@ddd-ts-kit/audit/knex';
export const up = (knex) => createAuditTables(knex, { schema: 'audit' });
export const down = (knex) => dropAuditTables(knex, { schema: 'audit' });

// drizzle : dans les fichiers de schéma que lit drizzle-kit
import { auditChainsTable, auditEntriesTable, auditGuardStatements } from '@ddd-ts-kit/audit/drizzle';
export const auditEntries = auditEntriesTable('audit');
export const auditChains = auditChainsTable('audit');
// et dans une migration personnalisée (drizzle-kit generate --custom), puisque drizzle-kit n'écrit aucun trigger :
for (const statement of auditGuardStatements('audit')) {
  await db.execute(sql.raw(statement));
}

new DrizzleAuditTrail(unitOfWork, { schema: 'audit' });
```

Deux tables : `audit_entries` (clé primaire `(chain, sequence)`, `id` unique, des index pour le
lecteur) et `audit_chains`, une ligne par chaîne qui détient sa dernière séquence et son dernier
hachage.

**Concurrence.** Un ajout insère la ligne de tête de sa chaîne si elle manque, puis la prend avec
`SELECT ... FOR UPDATE`, calcule l'entrée à partir d'elle, insère l'entrée et avance la tête. Le
verrou de ligne dure jusqu'à la fin de la transaction : deux ajouts à une même chaîne ne lisent
donc jamais la même tête, et la chaîne ne peut pas bifurquer ; les ajouts à d'autres chaînes
n'attendent pas. La clé primaire refuse une position en double si le verrou devait un jour être
contourné. En `REPEATABLE READ` ou `SERIALIZABLE`, le second ajout échoue sur une erreur de
sérialisation au lieu d'attendre, et son appelant rejoue l'unité de travail, comme pour toute autre
instruction à ces niveaux : le kit ne la rejoue pas.

![Trois transactions ajoutent en même temps : T1 verrouille la tête de tenant:acme, écrit l'entrée 42 et valide ; T2, sur la même chaîne, attend cette validation, puis lit 42 et écrit l'entrée 43 ; T3, sur tenant:globex, écrit l'entrée 8 sans attendre](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/audit-chain-append.fr.svg)

**En ajout seul dans la base de données aussi.** Le *helper* de migration crée la fonction
`audit_entries_append_only` et deux triggers : `UPDATE`, `DELETE` et `TRUNCATE` sur
`audit_entries` lèvent le SQLSTATE `23001`, qui que ce soit qui les demande. Les triggers arrêtent
les erreurs et les bogues de l'application ; un rôle propriétaire de la table peut les supprimer.
L'application ne devrait donc pas posséder la table. Exécutez les migrations avec un rôle
propriétaire et ne donnez au rôle de l'application que ce dont il a besoin :

```sql
revoke all on all tables in schema "audit" from public;
grant usage on schema "audit" to app;
grant select, insert on "audit"."audit_entries" to app;
grant select, insert, update on "audit"."audit_chains" to app;
```

L'application ne peut alors ni réécrire une entrée, ni désactiver ou supprimer la garde. Il reste
le rôle propriétaire et le superutilisateur, et c'est à cela que sert l'ancrage.

Un nouveau store passe la même suite que ceux-ci :

```ts
import { auditTrailContract } from '@ddd-ts-kit/audit/testing';
auditTrailContract({ describe, it, expect, beforeEach }, { name: 'MyAuditTrail', createTrail: () => freshTrail(), tamper });
```

## Interroger le journal

```ts
const page = await reader.search(
  { tenantId: 'acme', actorId: 'ada', category: 'authorization', outcome: 'denied', from, to },
  cursorPage({ limit: 50, sort: [{ field: 'occurredAt', direction: 'desc' }] }),
);
```

Filtres : `actorId`, `resource` (`{ type, id? }`), `action`, `category`, `outcome`, période
(`from` inclus, `to` exclu), `correlationId`, `tenantId`, `chain`, `fromSequence`,
`toSequence`. La pagination utilise les types du noyau : une page par offset renvoie `total`, une
page par curseur `nextCursor`. Triez par `occurredAt` (puis par chaîne et par séquence, l'ordre
dans lequel une personne lit) ou par `sequence` (chaîne par chaîne, l'ordre de la vérification).

`AuditReader` est un port à part parce que lire le journal est en soi un acte sensible. Exposez-le
comme un cas d'usage comme un autre, ce qui le rend protégé et audité par les mécanismes
ci-dessus :

```ts
// application/queries/search-audit-entries/search-audit-entries.query.ts
import { AuthorizedQuery, type AuditEntry, type Page } from '@ddd-ts-kit/kernel';

export class SearchAuditEntriesQuery extends AuthorizedQuery<Page<AuditEntry>> { /* actor, tenantId, filter, page */ }

// autorisation : refus par défaut, une seule permission, signalée comme sensible
requires(SearchAuditEntriesQuery, auditPermissions['trail.read']);
auditDecisions(trail, { ...source, sensitivePermissions: ['audit:trail.read'] });
auditMiddleware(trail, { ...source, queries: [SearchAuditEntriesQuery] });
```

```ts
// application/queries/search-audit-entries/search-audit-entries.handler.ts
import { AuditReader, type AuditEntry, type Page } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';

@QueryHandler(SearchAuditEntriesQuery)
export class SearchAuditEntriesHandler {
  constructor(private readonly reader: AuditReader) {}

  execute(query: SearchAuditEntriesQuery): Promise<Page<AuditEntry>> {
    return this.reader.search({ ...query.filter, tenantId: query.tenantId }, query.page);
  }
}
```

Quiconque lit le journal y laisse une entrée. Le gestionnaire dépend de l'`AuditReader` du noyau,
que `application/` a le droit d'importer, et reçoit le store qui lui est lié. Il restreint le
filtre au *tenant* de l'acteur (un périmètre d'accès calculé par l'*authorizer*) : un *tenant* ne
liste donc jamais les entrées d'un autre.

Dans un projet multitenant, liez `new TenantAuditReader(store, executionScope)` à `AuditReader`
plutôt que le store lui-même : chaque recherche est alors restreinte au *tenant* du travail, quoi
que dise son filtre (un filtre qui nomme un autre *tenant* ou une autre chaîne ne trouve rien),
l'équipe de la plateforme ne lit à travers les *tenants* que sous une élévation (`acrossTenants`
du noyau, elle-même enregistrée), et un travail qui ne nomme ni l'un ni l'autre est refusé
(`NoCurrentTenantError`).

## Limites

- **PostgreSQL seulement** pour les stores SQL : verrous de ligne, comparaison de lignes pour les
  curseurs, `jsonb`, triggers. Une autre base de données est un autre adaptateur des deux ports,
  tenu à la suite de contrat.
- **Les ajouts à une chaîne sont sérialisés**, et dans une unité de travail la tête reste
  verrouillée jusqu'à la validation. `auditMiddleware` écrit en dernier, la fenêtre est donc
  courte ; un gestionnaire qui enregistre à la main tôt puis travaille longtemps fait attendre les
  autres écrivains de son *tenant*.
- **Une unité de travail annulée libère ses positions** : l'entrée suivante réutilise la
  séquence. Il n'y a jamais de trou, et jamais d'entrée pour un travail qui n'a pas été validé.
- **Une commande envoyée depuis une autre unité de travail** (un consommateur dont `consume` en a
  ouvert une) partage son sort : si cette transaction englobante est annulée, l'entrée `failed`
  part avec elle.
- **La chaîne prouve l'intégrité, pas l'exhaustivité de la capture** : un fait qui n'a jamais
  atteint une source (un script qui écrit dans la base de données, une route qui contourne le bus)
  n'y est pas. Garder chaque route sur le bus, c'est à cela que servent `authz/declared` et les
  règles de dépendance.
- **`occurredAt` est l'horloge de l'instance qui a enregistré** ; dans une chaîne, l'ordre est la
  séquence.
- **La vérification lit la plage en mémoire**, et fait confiance à l'entrée qui précède `from`.
- **Aucune politique de rétention ni d'archivage** n'est fournie : combien de temps les entrées
  sont gardées, et où vont les anciennes chaînes, est une décision du projet. Supprimer
  d'anciennes entrées signifie retirer la garde délibérément, par le rôle propriétaire, après
  avoir ancré l'entrée qui devient le nouveau début.
- drizzle enveloppe les erreurs du pilote et affiche les paramètres de l'instruction en échec dans
  le message de son erreur. L'entrée d'une insertion d'audit ne contient que des identifiants et
  des codes ; journalisez tout de même le `code` d'une telle erreur, pas son message.
