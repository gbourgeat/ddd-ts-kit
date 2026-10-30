[English](multitenancy.md) · **Français**
<!-- translation-of: multitenancy.md sha256:ed78b76506e7549a -->

# Multitenance

**Résumé.** Une application multitenant sert plusieurs clients (les *tenants*) depuis un seul
déploiement, et aucun *tenant* ne doit jamais lire ni modifier ce qui appartient à un autre. Le
kit traite le *tenant* comme l'identifiant de corrélation : il est résolu une fois, à la
frontière, porté par le contexte d'exécution de chaque unité de travail (une requête HTTP, un
événement consommé, une exécution de *job*), et lu par l'infrastructure seule. L'isolation est
ensuite imposée là où vivent les données, par l'une de plusieurs stratégies choisie par projet,
et prouvée par un contrat qui s'exécute contre chaque adaptateur. Les cas d'usage ne filtrent
jamais par *tenant* à la main : oublier une condition est une fuite, donc cette condition n'est
pas à eux de l'écrire.

## Ce qu'est un tenant, et ce qu'il n'est pas

Un *tenant* est le client à qui appartiennent les données : une clinique, une entreprise, une
école. Ce n'est pas un rôle (ce que quelqu'un a le droit de faire), ni un attribut d'un élément
qu'une permission compare (le service d'un document). Le test : si deux *tenants* étaient deux
installations séparées, cette donnée serait-elle dans une seule d'entre elles ? Alors c'est une
donnée du *tenant*.

Certaines données n'appartiennent à aucun *tenant* : le catalogue de la plateforme, les
*tenants* eux-mêmes, les offres. Elles vivent dans des tables sans colonne de *tenant*, et le
travail qui les lit ne nomme aucun *tenant*.

## Le tenant dans la portée d'exécution

| Origine | D'où vient le *tenant* |
|---|---|
| Requête HTTP | le résolveur de la frontière (sous-domaine, en-tête, segment de chemin ou *claim* du jeton), vérifié contre les appartenances de l'acteur ; par défaut, le *tenant* propre de l'acteur |
| Événement d'intégration consommé | le `tenantId` de l'enveloppe, apposé par le *publisher* d'après le travail qui l'a publié |
| *Job* planifié | aucun pour un *job* `global` ; chaque *tenant* du `TenantDirectory` tour à tour pour un *job* `per-tenant` |
| Équipe de la plateforme | aucun qui lui soit propre : elle atteint les *tenants* par une élévation explicite et auditée |

![Trois frontières nomment le tenant (une requête HTTP par un résolveur vérifié contre les appartenances, un événement consommé par son enveloppe, un job par tenant une fois pour chaque tenant) et ouvrent avec lui la portée d'exécution ; les repositories, l'outbox et les brokers, les clés de cache et de verrou, les journaux et le journal d'audit le lisent ; les gestionnaires et le domaine jamais](../assets/diagrams/multitenancy-tenant-flow.fr.svg)

Un identifiant de *tenant* a une seule grammaire, `isTenantId` : lettres, chiffres, `_` et `-`,
63 caractères au plus (un *slug* ou un UUID). Chaque entrée refuse tout autre : la frontière
répond 404 à une requête HTTP qui en nomme un, un *broker* traite comme empoisonnée une enveloppe
qui en porte un, `executionContext`, `InMemoryTenantDirectory` et les réglages de la sécurité au
niveau des lignes lèvent `InvalidTenantIdError`, et `acrossTenants` refuse une élévation qui en
nomme un (`InvalidTenantElevationError`). Rien de ce que contient un identifiant de *tenant* ne
peut alors se lire comme un joker (`*`), une liste (`a,b`) ou un morceau de clé (`a:b`).

`tenantScopeOf(scope)` répond le *tenant* unique que nomme une écriture et refuse le travail qui
n'en nomme aucun (`NoCurrentTenantError`) : une instruction ne peut pas s'exécuter sans portée
par oubli. `tenantReachOf(scope)` est le côté lecture : le *tenant* du travail, ou les *tenants*
d'une élévation. Avec le double de test de la portée, ce que chacun répond :

<!-- checked sample -->
```ts
import {
  executionContext,
  FixedExecutionScope,
  NoCurrentTenantError,
  systemActor,
  tenantKey,
  tenantReachOf,
  tenantScopeOf,
} from '@ddd-ts-kit/kernel';

const inAcme = new FixedExecutionScope(
  executionContext({ correlationId: 'req-42', actor: systemActor('demo'), origin: 'cli', tenantId: 'acme' }),
);

console.log(tenantScopeOf(inAcme)); // { tenantId: 'acme' } : le tenant unique que nomme une écriture
console.log(tenantReachOf(inAcme)); // { kind: 'tenant', tenantId: 'acme' } : ce qu'une lecture peut voir
console.log(tenantKey(inAcme, 'reminders', 'a:b')); // 'tenant:acme:reminders:a%3Ab'

const inNoTenant = new FixedExecutionScope(
  executionContext({ correlationId: 'req-43', actor: systemActor('demo'), origin: 'cli' }),
);

try {
  tenantScopeOf(inNoTenant);
} catch (error) {
  console.log(error instanceof NoCurrentTenantError); // true : pas de tenant, pas d'instruction
}
```

## L'isolation : quatre stratégies

Le *tenant* atteint le stockage par la portée d'exécution ; la stratégie décide ce qui empêche
une instruction de passer chez un autre *tenant*.

![Quatre stratégies d'isolation côte à côte : des tables partagées avec une colonne tenant_id, les mêmes sous sécurité au niveau des lignes, un schéma par tenant dans une seule base, une base par tenant ; de gauche à droite, le partage diminue et la séparation grandit](../assets/diagrams/multitenancy-isolation-strategies.fr.svg)

| Stratégie | Ce qui isole | La choisir quand | Ce qu'elle coûte |
|---|---|---|---|
| Tables partagées | une colonne `tenant_id`, et une condition que le kit ajoute à chaque instruction | beaucoup de petits *tenants*, un seul schéma à migrer, des rapports qui traversent les *tenants* | une condition oubliée est une fuite : ce sont les *helpers* et une règle du *checker* qui l'empêchent |
| Tables partagées sous sécurité au niveau des lignes (row-level security) | la même chose, et une politique PostgreSQL qui refuse la ligne d'un autre *tenant* même à une instruction sans sa condition | le cas des tables partagées, avec une seconde ligne de défense | un rôle qui n'est pas superutilisateur, chaque instruction dans une transaction |
| Un schéma par *tenant* | une copie des tables d'un contexte par *tenant* (`<schema>__<tenant>`) | des *tenants* qui veulent leurs données à part, exporter ou supprimer un *tenant* d'un coup, quelques centaines de *tenants* | les migrations s'exécutent une fois par *tenant* ; des milliers de schémas surchargent le catalogue |
| Une base par *tenant* | une base de données par *tenant*, un *pool* borné pour chacune | une séparation stricte (contrats, régions), de gros *tenants*, sauvegarde et restauration par *tenant* | les connexions (`maxTenants * pool.max` par instance), une exécution de migration par *tenant* |

Ce que fournit chaque adaptateur, prouvé par `tenantIsolationContract`
(`@ddd-ts-kit/testing/contracts`) sur PostgreSQL :

| Stratégie | Knex | Drizzle | Prisma | TypeORM |
|---|---|---|---|---|
| Tables partagées | `tenantTable`, `ownTenantTable`, `whereTenant`, `derivedTable` ; modèles de lecture avec `tenant` ; `addTenantColumn` pour migrer | `tenantCondition`, `ownTenantCondition` ; modèles de lecture avec `tenant` | `tenantWhere` et `ownTenantWhere` décomposés dans le where, `tenantScopeOf` dans les données ; modèles de lecture avec `tenant` ; l'outbox avec `tenant: true` | `tenantWhere` et `ownTenantWhere` ; modèles de lecture avec `tenant` ; `outboxEntity({ tenant: true })` |
| Sécurité au niveau des lignes | `enableTenantIsolation`, `tenantSession` | `tenantPolicies`, `forceRowLevelSecurity`, `tenantSession` | non fourni | non fourni |
| Un schéma par *tenant* | `tenantSchemaTable`, `migrateTenantSchema`, `tenantSearchPath` | non fourni : une table drizzle est liée à son schéma là où elle est déclarée | non fourni | non fourni |
| Une base par *tenant* | `TenantDatabases`, `createTenantRoutedUnitOfWork`, `migrateEveryTenant` | non fourni | non fourni | non fourni |

`init --tenancy shared-table` génère la première stratégie sur les quatre ORM : chaque
*repository* passe par les *helpers*, l'outbox garde le *tenant*, et la règle
`tenancy/scoped-statement` du *checker* signale une instruction qui atteint une table directement
depuis l'exécuteur, le client ou le *manager*, une ligne atteinte par sa seule clé, un registre de
modèles de lecture construit sans son *tenant*. Les trois autres se câblent à la main à partir des *packages* pour l'instant ;
`init` les refuse et dit quoi ajouter.

La condition du *tenant* ne vaut pour chaque ligne que si elle reste en `and` avec tout le reste de
l'instruction. SQL lie `and` avant `or` : une alternative écrite à côté de la condition est donc
en dehors d'elle. Les alternatives vont dans un groupe lié à la condition par un `and`, et la règle
signale toute autre forme :

| ORM | La condition du *tenant* | Les alternatives |
|---|---|---|
| Knex | aucun `.orWhere*` ou `.or` au sommet d'une instruction de `tenantTable`, `ownTenantTable` ou `whereTenant`, aucun `clearWhere()` ou `clear('where')` : les *helpers* les refusent aussi à la construction de l'instruction (`UngroupedOrError`, `ClearedTenantConditionError`), et tiennent le texte d'un `whereRaw`, ou un `knex.raw` donné à un *where*, pour un seul terme entre parenthèses. Un `orHaving` s'applique après le *where* et reste libre | `.where((either) => either.where(a).orWhere(b))` |
| Drizzle | un argument direct de `where` ou de `and`, jamais sous `or`, `not` ou un gabarit `sql` | `.where(and(tenantCondition(column, scope), or(a, b)))` |
| Prisma | étalée au sommet du `where` ou de son `AND`, jamais sous `OR`, `NOT` ou une relation | `where: { ...tenantWhere(scope), OR: [a, b] }` |
| TypeORM | étalée au sommet du *where* ; un tableau *where* est un `or` de ses entrées, chacune l'étale donc ; aucun `orWhere` au sommet d'un *query builder*, et la condition dans son dernier `where` ou un `andWhere` après lui, puisqu'un `where` réinitialise ce qui le précède | `.andWhere(new Brackets((either) => either.where(a).orWhere(b)))` |

Un contexte dont les tables n'appartiennent à aucun *tenant*, parce qu'il décide qui appartient à
quel *tenant*, est déclaré tel dans la configuration plutôt que désactivé instruction par
instruction : `"tenancy": "control-plane"` sous `contexts.<name>`, une dérogation enregistrée dans
`deviations` avec son enregistrement de décision. La règle laisse alors ses adaptateurs de côté et
`generate repository` n'en cloisonne aucun. Le *preset* identity écrit les trois, la clé, l'entrée
et l'enregistrement. Une table d'un autre contexte qui ne contient aucune donnée de *tenant* reste
une désactivation qui nomme son enregistrement.

Un *repository* sur tables partagées, version simplifiée de ce qu'écrit le générateur sur Knex (les
colonnes d'audit et le `Clock` qu'elles demandent sont omis) : chaque instruction
passe par un *helper* qui lit le *tenant* dans la portée, lit par `tenantTable`, écrit par
`ownTenantTable`, et une insertion nomme son *tenant* avec `tenantRow` :

<!-- checked sample -->
```ts
// contexts/appointments/infrastructure/persistence/knex-appointment.repository.ts
import { AggregateRoot, tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import {
  insertIgnoringConflict,
  optimisticUpdate,
  ownTenantTable,
  tenantRow,
  tenantTable,
  type KnexContext,
  type TenantRow,
} from '@ddd-ts-kit/knex';

interface AppointmentColumns {
  readonly id: string;
  readonly practitioner_id: string;
  readonly status: 'booked' | 'cancelled';
}
type VersionedAppointment = AppointmentColumns & { readonly version: number };
type AppointmentRow = VersionedAppointment & TenantRow;

// L'agrégat et son mapper, dans domain/ et infrastructure/persistence/ :
declare class Appointment extends AggregateRoot<string> {
  private constructor();
}
declare const AppointmentMapper: {
  toDomain(row: AppointmentRow): Appointment;
  toRow(appointment: Appointment): AppointmentColumns;
};

const TABLE = { schema: 'appointments', table: 'appointments' };

export class KnexAppointmentRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
  ) {}

  async findById(id: string): Promise<Appointment | undefined> {
    // Au lieu de : this.database.executor()<AppointmentRow, AppointmentRow[]>('appointments').where({ id }),
    // qui lit les lignes de tous les tenants (tenancy/scoped-statement). Écrire :
    const row = await tenantTable<AppointmentRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : AppointmentMapper.toDomain(row);
  }

  async save(appointment: Appointment): Promise<void> {
    await optimisticUpdate(appointment, async ({ expected, next }) => {
      const state = { ...AppointmentMapper.toRow(appointment), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedAppointment): Promise<number> {
    const row = { ...state, ...tenantRow(tenantScopeOf(this.scope)) }; // { tenant_id: 'acme' }
    const table = ownTenantTable<AppointmentRow>(this.database, this.scope, TABLE);
    const inserted = await insertIgnoringConflict(this.database.executor(), table, { row, conflict: 'id' });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedAppointment, expected: number): Promise<number> {
    // Le tenant unique du travail, même sous une élévation : les lectures peuvent s'élargir, les écritures jamais.
    return ownTenantTable<AppointmentRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update(state);
  }
}
```

Un projet d'un seul client qui devient multitenant garde ses données : sur Knex, une migration
appelle `addTenantColumn(knex, { schema, table, tenantOfExistingRows })` pour chaque table de
données de *tenant* (les lignes déjà présentes vont au client qu'elle servait, puis la colonne
devient obligatoire et indexée) et `addOutboxTenantColumn(knex, { schema, tenantOfUnpublished })`
pour l'outbox (les événements pas encore publiés vont aussi à ce client, pour que leurs
consommateurs s'exécutent dans son *tenant*). Une table qui a déjà la colonne est laissée telle
quelle, si bien que la migration s'exécute aussi sur une base construite depuis le schéma actuel.
L'application d'exemple a suivi ce chemin (son ADR-0003) : un réseau de cabinets est un *tenant*.
Sur Drizzle, Prisma et TypeORM, la colonne rejoint la déclaration de la table (`tenantColumn()`, le
champ `tenantId` du modèle), l'outillage de migration de l'ORM écrit la migration (`drizzle-kit
generate`, `prisma migrate dev`, `typeorm migration:generate`), et une instruction de cette
migration donne aux lignes déjà présentes le *tenant* qu'elles servaient, avant que la colonne soit
rendue obligatoire et indexée.

L'outbox garde le *tenant* de chaque événement sur Knex (`tenant: true`), Drizzle
(`tenantOutboxTable`), Prisma (`tenant: true`, sur un modèle qui porte le champ `tenantId` que le
fragment livré laisse en commentaire) et TypeORM (`outboxEntity({ tenant: true })`), si bien que
ses consommateurs s'exécutent dans ce *tenant*.

L'event store d'un agrégat en *event sourcing* garde le *tenant* de chaque flux de la même façon.
À qui l'on donne la portée d'exécution, ce que fait `init --tenancy shared-table` sur les quatre ORM,
il refuse le travail qui ne nomme aucun *tenant* (`NoCurrentTenantError`), enregistre le *tenant* au
premier ajout dans la colonne `tenant_id`, nullable, des événements et refuse de lire un flux d'un
autre *tenant*, ou d'y ajouter (`EventStreamTenantError`), l'élévation ne faisant que lire ; les
projections qu'il alimente appliquent chaque événement dans le *tenant* de son flux. La file de
*jobs* tient la même ligne : `find` et `cancel` refusent le travail qui ne nomme aucun *tenant*, un
*job* système passant par `acrossTenants`. Sur Knex,
`addEventStoreTenantColumn(knex, { schema, tenantOfExistingStreams })` migre un store existant ;
sur Drizzle, Prisma et TypeORM, la colonne rejoint les tables livrées et l'outillage de l'ORM écrit
la migration. Voir [l'*event sourcing*](event-sourcing.fr.md#sous-des-tables-partagées-entre-tenants).

Trois règles tiennent quelle que soit la stratégie :

- **Les lectures peuvent s'élargir, les écritures jamais.** Une élévation élargit ce qu'une
  lecture atteint ; une mise à jour ou une suppression nomme toujours le *tenant* unique du
  travail (`ownTenantTable`, `ownTenantCondition`), si bien qu'une session de l'équipe qui lit à
  travers les *tenants* ne peut pas écrire à travers eux. Sous sécurité au niveau des lignes, la
  base le tient aussi : une politique par commande SQL, la sélection lisant l'étendue (reach),
  l'insertion, la mise à jour et la suppression seulement le *tenant* (`ddd_ts_kit.tenant_id`),
  et l'étendue d'une élévation gardée dans des réglages à part, que le travail non élevé
  laisse vides.
- **Pas de tenant, pas de données.** Le travail qui ne nomme aucun *tenant* est refusé avant tout
  SQL (`NoCurrentTenantError`) sur tables partagées et schémas, flux d'événements et *jobs* stockés
  compris, et n'atteint aucune base du tout avec une base par *tenant*. Sous sécurité au niveau des
  lignes, une instruction sans les réglages de *tenant* ne voit rien. Un projet sans multitenance
  ne garde rien de tout cela : ses stores ne connaissent pas les *tenants*.
- **Les clés sont uniques entre les tenants.** Les identifiants sont générés (des UUID), de sorte
  qu'une clé ne nomme jamais deux lignes ; le contrat d'isolation vérifie qu'un autre *tenant*
  qui enregistre sous un identifiant existant ne change rien.

## La propagation : chaque saut garde le tenant

- **Événements d'intégration.** `scopedPublisher` appose le *tenant* du travail sur chaque
  événement publié sans *tenant* ; l'outbox le garde (`tenant_id`, voir les *packages* de
  persistance) ; les *brokers* le portent dans l'enveloppe et dans un en-tête (`x-tenant-id`,
  `tenant-id` pour Redis Streams) ; `executionContextOfEvent` ouvre la portée du consommateur
  dans ce *tenant*. Un consommateur lit et écrit donc le *tenant* du fait qu'il traite, et rien
  d'autre.
- **Jobs planifiés.** Un *job* déclare `tenancy: 'global'` (par défaut) ou `'per-tenant'`. Un
  *job* par *tenant* s'exécute une fois par *tenant*, l'un après l'autre, chaque exécution dans
  la portée de ce *tenant* ; l'échec d'un *tenant* n'arrête pas les autres. Dans un projet avec
  `stack.tenancy`, `generate job` écrit `per-tenant` (`--global` pour un travail à travers les
  *tenants* : il s'exécute dans aucun *tenant*, donc un *repository* confiné à un *tenant* le
  refuse). Le planificateur interroge le `TenantDirectory` à chaque occurrence : avec le *preset* d'identité il
  liste les organisations de la base, donc l'une ouverte plus tard a son exécution ; sinon `init` lui
  donne les identifiants de `TENANTS`, lus une seule fois au démarrage, et une liste fixe manque un
  *tenant* créé plus tard (voir [Jobs planifiés](scheduled-jobs.fr.md)).
- **Caches, limites de débit et verrous.** Une clé d'un stockage partagé est confinée au
  *tenant* : `tenantCacheKey(scope, ...)`, `tenantKey(scope, ...)`, chaque segment encodé en
  pourcentage pour que deux listes de segments ne donnent jamais la même clé. Une clé construite
  sans eux est partagée par tous les *tenants*, ce qui ne convient qu'aux données de la
  plateforme.
- **Journaux, traces, remontées d'erreurs et journal d'audit.** `logFieldsOf` écrit `tenantId`
  sur chaque ligne ; le journal d'audit garde une chaîne de hachage par *tenant* (`tenant:<id>`),
  pour que l'historique d'un *tenant* puisse être remis et vérifié seul. Sa recherche est
  confinée au *tenant* du travail par `TenantAuditReader`, que `init --tenancy shared-table`
  câble dans le côté lecture du journal : un acteur qui ne nomme aucun *tenant* ne lit rien, et
  l'équipe de la plateforme ne lit le journal d'un autre *tenant* qu'à l'intérieur de
  `acrossTenants`. Un refus à la frontière d'un appelant sans justificatif d'identité n'est pas enregistré,
  pour qu'aucune requête HTTP non authentifiée n'ouvre une chaîne.

## Ce que répond un refus

Un refus levé sous la frontière est un refus comme un autre, une `DomainError` répondue sur chaque
adaptateur HTTP et chaque procédure RPC, écrite en avertissement et envoyée à aucun suivi d'erreurs :

| Refus | Réponse | Quand |
|---|---|---|
| `NoCurrentTenantError` | 403 `FORBIDDEN` | l'appelant ne nomme aucun *tenant* : connecté avant d'en rejoindre un, ou une route publique sur des données de *tenant* |
| `InvalidTenantIdError` | 404 `NOT_FOUND` | un jeton ou une requête nomme un identifiant hors grammaire : aucun tel *tenant* ne peut exister |
| `EventStreamTenantError` | 404 `NOT_FOUND`, sans le flux | un ajout à un flux d'un autre *tenant* ; une lecture par un *repository* est l'élément inconnu du cas d'usage |

Un *job* ou un consommateur refusé pour la même raison échoue avec le même code (`FORBIDDEN`,
`NOT_FOUND`) dans `errorCode` et dans les métriques de ses exécutions.

## La résolution à la frontière

Le *pipeline* HTTP nomme le *tenant* d'une requête avec un résolveur de `@ddd-ts-kit/http` : le
sous-domaine (`acme.app.example.com`), un en-tête (`x-tenant-id`), un segment de chemin
(`/tenants/:tenantId/...`) ou le *claim* du jeton, ou le premier de plusieurs. Quoi qu'il le
nomme, le *pipeline* le vérifie contre les appartenances de l'appelant avant que quoi que ce soit
ne s'exécute, et répond 403 à un appelant qui n'en fait pas partie : le *tenant* que demande un
client est une demande, jamais une autorité. Un appelant authentifié est tenu à ses *tenants*
sur les routes publiques aussi ; un appelant anonyme y garde le *tenant* auquel il s'est adressé. La garde `TenantMember` réserve un groupe de routes aux membres du *tenant*
de la requête.

Lequel choisir : le *claim* seul quand un utilisateur appartient à un seul *tenant* ; un
sous-domaine quand les *tenants* ont leur propre adresse (et leurs propres cookies) ; un segment
de chemin ou un en-tête quand un utilisateur travaille dans plusieurs *tenants* et en choisit un
par requête HTTP, le jeton listant alors chaque appartenance (un *claim* de *tenant* qui contient
une liste, ou le *claim* `organization` de Keycloak, donne à l'acteur ses `tenants`).

Un *tenant* que le déploiement ne sert pas, que son annuaire des *tenants* (les *tenants* pour
lesquels ses *jobs* s'exécutent) ne liste pas, a intérêt à n'être pas trouvé du tout :
`servedTenantOf(resolver, served)` répond 404 à quiconque le nomme, pour qu'un justificatif émis
pour un *tenant* dont le déploiement ne sait rien n'écrive jamais de données qu'aucun *job* ni
aucun opérateur ne verrait. L'application d'exemple sert ainsi les réseaux de `NETWORKS`.

## L'équipe de la plateforme : l'élévation, jamais implicite

Le support et l'exploitation ont parfois besoin de lire à travers les *tenants*. Le kit refuse de
le déduire d'un rôle : un rôle qui élargirait en silence chaque requête ferait d'une session volée
une brèche dans chaque *tenant*. À la place :

1. Un cas d'usage ou une garde décide de la permission d'élever, comme de toute permission.
2. La plateforme appelle `acrossTenants({ scope, trail, clock, ids }, { reason, tenants }, work)` :
   un code de raison stable et les *tenants* atteints (`all` ou une liste) sont obligatoires.
3. L'élévation est écrite dans le journal d'audit (action `tenancy:elevate`) **avant** que le
   travail ne s'exécute ; un journal qui ne peut pas l'enregistrer la refuse.
4. À l'intérieur, les lectures voient les *tenants* nommés ; les écritures nomment toujours un
   seul *tenant*.

<!-- checked sample -->
```ts
// platform/support/appointments-for-a-ticket.ts
import { acrossTenants, type AuditTrail, type Clock, type ExecutionScope, type IdGenerator } from '@ddd-ts-kit/kernel';

// Résolus depuis le conteneur par la plateforme :
declare const scope: ExecutionScope;
declare const trail: AuditTrail;
declare const clock: Clock;
declare const ids: IdGenerator;
// Une lecture par tenantTable, qui suit l'étendue de la portée d'exécution :
declare function searchAppointments(practitionerId: string): Promise<readonly { readonly id: string }[]>;

export async function appointmentsForATicket(practitionerId: string, tenants: readonly string[]) {
  // La permission d'élever a été décidée avant cet appel, comme toute permission.
  return acrossTenants(
    { scope, trail, clock, ids },
    { reason: 'SUPPORT_TICKET', tenants }, // un code stable, et les tenants atteints ('all' ou une liste)
    () => searchAppointments(practitionerId), // enregistré comme tenancy:elevate avant de s'exécuter
  );
}
```

## La seule écriture à travers les *tenants* : la purge de ce qui a dépassé sa durée de conservation

Chaque écriture du kit reste dans le *tenant* du travail, et une élévation n'en élargit jamais
aucune : un effacement tourne une fois par *tenant* de `TENANTS`, dans un contexte d'exécution de ce
*tenant*. Il existe une exception, choisie et bornée : `purgeExpired(now)` des adaptateurs
d'effacement, que lance le *job* de nuit `privacy.purge-expired` de la plateforme (page de concept
[Les données personnelles](personal-data.fr.md#la-conservation-chaque-nuit)).

- **Pourquoi.** La durée de conservation est une politique de la table, la même pour chaque
  *tenant*, et la limitation de la conservation est due à chacun d'eux. Une purge confinée à une
  liste de *tenants* garderait, dans un *tenant* oublié de cette liste, des données qui devaient
  disparaître : l'échec serait silencieux et le manquement réel.
- **Quand.** Seulement quand le travail ne nomme aucun *tenant* : le *job* de la plateforme, ou
  `npm run privacy:purge`, tous deux hors de toute requête. Dans le contexte d'un *tenant*, le même
  adaptateur confine sa purge à ce *tenant*, comme toute autre écriture.
- **Ce qu'elle peut faire.** Effacer, comme la déclaration le dit, les lignes dont la colonne de date
  est plus ancienne que la durée : les supprimer ou pseudonymiser leurs colonnes personnelles. Elle
  ne relit rien, ne déplace rien d'un *tenant* à un autre, et son critère est la seule date de la
  ligne, jamais la personne qu'elle concerne ni le *tenant* qui la tient.
- **Ce qu'elle laisse.** Avec le journal d'audit actif, une entrée par contexte et par passage
  (`personal-data:purge`, le nombre de lignes, aucune personne), dans la chaîne de la plateforme.

Un projet qui veut une purge confinée la lance plutôt par *tenant*, dans des contextes de ces
*tenants* (`eachTenant`), et prend à sa charge le devoir de la liste.

## Limites et quand ne pas l'utiliser

- **Un tenant par unité de travail.** Une requête HTTP qui doit écrire dans deux *tenants* fait
  deux unités de travail, à dessein : une transaction ne couvre jamais plusieurs *tenants*. Avec
  une base par *tenant*, le travail d'un autre *tenant* lancé à l'intérieur d'une unité de
  travail ouverte est refusé (`CrossTenantUnitOfWorkError`) ; sur tables partagées et schémas, il
  rejoindrait la transaction du premier *tenant*, donc ouvrez une unité de travail par *tenant*
  (une élévation ne fait que lire, et n'en a pas besoin).
- **Le tenant appartient à l'infrastructure.** Une règle métier qui dépend du *tenant* (une
  offre, un réglage) le reçoit comme donnée dans la commande, comme l'acteur ; elle ne lit pas la
  portée.
- **Un produit à client unique n'a besoin de rien de tout cela.** Les stratégies coûtent une
  colonne, une politique, un schéma ou une base par *tenant*, et la discipline de prouver
  l'isolation.

## Sources

- Microsoft, « Tenancy models for SaaS applications » (documentation d'Azure SQL Database) :
  tables partagées, schéma et base par *tenant*, et leurs compromis.
- Documentation de PostgreSQL, « Row Security Policies » (section 5.9 du manuel).
- AWS SaaS Lens, « Tenant isolation » (Well-Architected Framework).

## Voir aussi

- [Acteur et portée d'exécution](actor-and-execution-scope.fr.md)
- [Authentification et autorisation](authentication-and-authorization.fr.md)
- [Journal d'audit](audit-trail.fr.md)
- [Jobs planifiés](scheduled-jobs.fr.md)
- [Persistance](../tools/persistence.fr.md)
