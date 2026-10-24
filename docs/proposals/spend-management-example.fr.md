[English](spend-management-example.md) · **Français**
<!-- translation-of: spend-management-example.md sha256:94500933d3c969b0 -->

# Proposition : un second exemple, la gestion des dépenses sur la pile la plus populaire

**Résumé.** Le kit a un exemple, [scheduling](../../examples/README.fr.md) : Express,
class-validator, tsyringe en style déclaré, Knex, Redis Streams, Keycloak, ReBAC, Vitest. Il
prouve la méthode sur les valeurs par défaut d'`init` et leurs variantes les plus proches. Cette
page spécifie un second exemple qui la prouve sur l'autre moitié de la pile : NestJS avec son
propre conteneur, Prisma, Jest, Kafka, S3, ABAC, Winston, Scalar, en style explicite, sur un
métier que toute entreprise connaît et qu'aucune ne pratique de la même façon, la gestion des
dépenses (notes de frais, cartes d'entreprise, approbations, budgets, remboursements, l'export
comptable). Elle est écrite pour être donnée aux *skills* story et parallel-work comme énoncé du
travail. Sa première partie n'est pas l'exemple : un essai à blanc d'`init` le 2026-10-24 montre
que la pile la plus populaire éteint quatre capacités du kit (tâches de fond et processus, la
*tenancy* en table partagée, la piste d'audit SQL, le *preset* identity) ; le kit est donc
corrigé d'abord, et l'exemple est la preuve que les corrections tiennent. MySQL est une décision
prise ici, pas un oubli : pas dans cet exemple, avec la liste de ce qu'il faudrait.

## État (2026-10-25)

**Spécifié, partie 1 en cours.** La pile ci-dessous a été passée à `init --dry-run` sur 0.88.0,
d'où viennent les refus de la partie 1. Chaque partie est une ou plusieurs *pull requests* ; une
partie est marquée construite ici quand sa dernière *pull request* est fusionnée.

| Partie | Verdict |
|---|---|
| 1. Le kit sur la pile : file et processus sur Nest, *tenancy* et audit sur Prisma, le *preset* sur Nest et Prisma | en cours, avant l'exemple : 1.1 construite (#273), 1.2 construite (#276, modèles de lecture compris), 1.3 construite (#297), 1.4 construite (#287), 1.5 à construire |
| 2. L'exemple : `examples/spend-management`, sept contextes, les documents de la méthode | à construire, après la partie 1 |
| 3. Le dépôt : un second *workspace* dans les portes, le site, la page des exemples | à construire, avec la partie 2 |
| MySQL | **pas dans cet exemple**, voir [Ce qui est laissé de côté](#ce-qui-est-laissé-de-côté-et-pourquoi) |

## Pourquoi un second exemple, et pourquoi celui-là

Deux souhaits ont guidé le choix et se contredisent en partie : les technologies les plus
populaires, et autant de capacités du kit qu'une application peut en exercer.

**La pile la plus populaire n'est pas la pile par défaut.** Aux téléchargements et aux offres
d'emploi, le *back end* TypeScript de 2026 est NestJS (environ 16 millions de téléchargements
hebdomadaires de `@nestjs/core`, [Frameworks HTTP](../tools/http-frameworks.fr.md)),
class-validator avec lui, Prisma comme ORM, Jest comme lanceur, Kafka comme *broker*, S3 comme
stockage de fichiers, Winston comme *logger*. L'exemple scheduling ne montre rien de cela sauf
class-validator. Un lecteur qui vient de ce monde ne trouve aucune page du kit écrite dans ses
mots, et le kit lui-même n'a passé cette pile que par la matrice générée de `stacks.ts` (zéro
signalement et une vérification de types), jamais par une application entière avec une porte,
une exécution réelle et un rapport d'outillage.

**Cette pile éteint des capacités.** `init` refuse, aujourd'hui, sur 0.88.0 :

| Drapeaux | Refus d'`init` ou de `generate` | Où |
|---|---|---|
| `--di nest --queue database` ou `--queue redis` | `--queue database cannot be combined with --di nest` : le magasin de tâches est lié par le module noyau de `@ddd-ts-kit/di` | `packages/cli/src/init/stack/resolve-queue.ts` |
| `--di nest`, puis `generate background-job` ou `generate process` | `A background job cannot be generated with --di nest` : la file, son *worker* et le lanceur de processus sont liés par le module noyau | `packages/cli/src/generate/kinds/background/require-container.ts` |
| `--orm prisma --tenancy shared-table` (TypeORM de même) | les aides au *tenant* sont générées pour Knex et Drizzle | `packages/cli/src/init/stack/resolve-tenancy.ts` |
| `--orm prisma --queue database` | la table des tâches est livrée avec `@ddd-ts-kit/knex` et `@ddd-ts-kit/drizzle` | `resolve-queue.ts` |
| `--orm prisma --audit on` | accepté, mais le projet démarre sur une piste en mémoire derrière un `TODO(platform)` : le *package* d'audit ne stocke que sur Knex et Drizzle | `packages/cli/templates/init/platform/audit/create-audit.ts.tpl` |
| `--di nest --preset identity` | le *preset* identity n'est pas écrit pour `stack.style: explicit`, ni pour Prisma, ni pour `http: nest` | `packages/cli/src/presets/identity-refusal.ts` |
| `--orm prisma --database mysql` | les adaptateurs générés sont écrits pour PostgreSQL | `packages/cli/src/init/stack/resolve-persistence.ts` |

Chaque ligne sauf la dernière est un manque du kit, pas une limite de la technologie : Nest a un
conteneur qui peut porter un `JobStore`, Prisma écrit un `where` avec un *tenant* aussi bien que
Knex. Un exemple qui les contournerait (tâches en mémoire, *tenancy* à la main, pas d'audit,
identity reconstruit avec les générateurs) enseignerait le contournement. Les manques sont donc
comblés d'abord, et l'exemple est ce qui prouve qu'ils le sont.

**Pourquoi la gestion des dépenses.** Le métier doit être lisible par n'importe qui, à la
différence d'une verticale de niche, et assez complexe pour que chaque capacité du kit réponde
à un besoin réel plutôt qu'à une démonstration : de l'argent (objets-valeurs, devises,
arrondis), des règles sur des montants et des personnes (ABAC : seuils, auto-approbation
interdite, la finance au-dessus d'une limite), des documents (justificatifs dans S3), un
système externe qui rappelle (l'émetteur de cartes, des *webhooks* idempotents, une couche
anticorruption), un processus long avec une échéance (une approbation qui escalade, un paiement
qui attend la banque), un grand livre qu'on ne réécrit jamais (un agrégat *event-sourced*), des
exports aux formats d'autres logiciels (CSV, XML, par négociation de contenu), des périodes qui
se clôturent à une date (tâches planifiées), une entreprise qui ne doit jamais en voir une autre
(*tenancy*). Scheduling a des créneaux et des agendas ; celui-ci a de l'argent et des *workflows*.
Ensemble, les deux exemples couvrent le kit deux fois, sur deux piles et deux métiers.

## Partie 1 : ce que le kit construit d'abord

Chaque point nomme le refus qu'il lève, les fichiers trouvés le 2026-10-24, ce qui est ajouté
et comment c'est prouvé. L'ordre est l'ordre des dépendances : l'exemple a besoin de tout à
l'`init`.

### 1.1 La file, le *worker* et les processus sur les conteneurs Nest et manuel

Aujourd'hui la plateforme manuelle (`platform.manual.ts.tpl`, `lay-foundations.manual.ts.tpl`,
`create-platform.manual.ts.tpl` sous `packages/cli/templates/init/platform/composition/`) ne
construit ni `JobQueue`, ni `QueueWorker`, ni `ProcessRunner`, alors que
`persistence-over.knex.ts.tpl` et `persistence-over.drizzle.ts.tpl` construisent déjà les
magasins (`jobs`, `processes`) et `open-redis.ts.tpl` le `RedisJobStore`. La plateforme tsyringe
les relie dans `platform.module.tsyringe.ts.tpl` à travers `kernelModule`.

À construire :

- la plateforme manuelle construit la file, le *worker* et le lanceur comme `kernelModule` le
  fait (`packages/di/src/kernel/kernel-module.ts`, lignes 218 à 252) : sur les `jobs` et
  `processes` de la persistance, ou sur `redis.jobs(..)`, avec l'horloge, la portée
  d'exécution, le *logger*, les métriques et le rapporteur d'erreurs, réglés par les mêmes
  options `queues` ; un point d'entrée *worker* (`generate worker`) qui les fait tourner sur
  `--di nest` et `--di manual` ;
- `resolve-queue.ts` accepte `--queue database` et `--queue redis` avec tout conteneur, et
  continue de refuser `database` avec un ORM sans table (levé pour Prisma par 1.3) ;
- `generate background-job` et `generate process` écrivent, dans la famille manuelle, la classe
  et son enregistrement dans `<context>.module.ts` (la famille `module.manual.ts.tpl` de
  `packages/cli/templates/context/`), comme la famille tsyringe écrit la déclaration ;
  `require-container.ts` disparaît ;
- `service-selection.ts` (le point d'entrée autonome d'un contexte) transmet le *worker* ;
- [Tâches de fond](../concepts/background-jobs.fr.md), [Sagas et gestionnaires de
  processus](../concepts/sagas-and-process-managers.fr.md), [Injection de
  dépendances](../tools/dependency-injection.fr.md) et [CONFIG.md](../CONFIG.fr.md) cessent de
  dire tsyringe seulement.

Preuve : `stacks.ts` gagne `nest + knex + queue database` et `nest + file redis` ; la spec de
bout en bout des tâches de fond tourne sur la pile Nest ; `init --dry-run` avec la commande de
la partie 2 passe ce refus.

### 1.2 La *tenancy* en table partagée sur Prisma, et sur TypeORM

Les aides existent sur Knex (`tenantTable`, `ownTenantTable`, `packages/knex/src/tenancy/`) et
Drizzle (`tenantCondition`, `ownTenantCondition`, `packages/drizzle/src/postgres/tenancy/`) ;
le README de Prisma montre le motif à la main (`where: { id, ...tenantScopeOf(this.scope) }`,
`packages/prisma/README.md`, « Audit columns, tenant scoping and pages ») ; TypeORM a la colonne
(`tenantColumn`) et pas la condition. Les magasins d'*outbox* de Knex
(`add-outbox-tenant-column.ts`) et de Drizzle (`tenant-outbox-table.ts`) gardent le *tenant* de
chaque événement pour qu'un consommateur tourne dedans ; `packages/prisma/src` et l'*outbox*
TypeORM ne portent aucun *tenant*.

À construire :

- `@ddd-ts-kit/prisma` : `tenantWhere(scope)` et `ownTenantWhere(scope)` (la condition que
  chaque lecture et écriture étale dans son `where` ; la seconde refuse l'élévation du personnel
  de la plateforme sur une écriture, comme `ownTenantTable`), la colonne *tenant* de l'*outbox*
  et des événements traités, le consommateur exécuté dans le *tenant* de l'événement, tenus aux
  mêmes suites de contrat que Knex ; les deux mêmes conditions sur TypeORM à côté de
  `tenantColumn` ;
- le dépôt Prisma généré avec `--tenant-scoped`, et chaque dépôt d'un projet initialisé avec
  `--tenancy shared-table` sur Prisma : les gabarits de `generate repository`, le fragment de
  `schema.prisma` (`tenant_id`, les index qui commencent par lui) ;
- la règle `tenancy/scoped-statement` (`packages/cli/src/check/rules/tenancy-scoped-statement.ts`)
  lit un appel de délégué Prisma (`findFirst`, `findMany`, `update`, `updateMany`, `delete`,
  `deleteMany`, `count`, `aggregate`) dont le `where` n'étale pas l'aide, et un *query builder*
  TypeORM sans la condition ; `tenancy-fixtures.ts` gagne les adaptateurs Prisma et TypeORM
  confinés et non confinés ; `findUnique` est signalé comme tel, le *tenant* ne faisant jamais
  partie de la clé ;
- `resolve-tenancy.ts` accepte Prisma et TypeORM ; [Multi-tenant](../concepts/multitenancy.fr.md),
  [Persistance](../tools/persistence.fr.md) et les deux README le disent.

Preuve : la suite de contrat de *tenancy* de `@ddd-ts-kit/testing` sur les magasins Prisma et
TypeORM (PGlite dans l'exécution unitaire, PostgreSQL dans le *job* d'intégration) ; la matrice
gagne `fastify + prisma + shared-table` ; la suite de conformité de l'exemple (partie 3) casse
la règle une fois dans un dépôt Prisma et doit la voir signalée.

### 1.3 Les tâches et les instances de processus sur Prisma

`KnexJobStore`, `KnexProcessStore`, `DrizzleJobStore`, `DrizzleProcessStore` existent, tenus à
`jobStoreContract` et au contrat du magasin de processus. À construire : `PrismaJobStore` et
`PrismaProcessStore` sur le schéma `messaging`, leurs modèles dans le `schema.prisma` généré
(`packages/cli/templates/init/platform/database/schema.prisma.tpl`) et leur liaison dans
`persistence-over.prisma.ts.tpl` ; `resolve-queue.ts` accepte `--queue database` avec Prisma.
La réclamation emploie le même `FOR UPDATE SKIP LOCKED` que la réclamation d'*outbox* Prisma
(`prisma-outbox-claim.ts`). TypeORM peut suivre dans la même *pull request* ou une suivante ;
l'exemple n'en a pas besoin.

Preuve : les deux suites de contrat sur PGlite et PostgreSQL ; `stacks.ts` gagne
`nest + prisma + queue database`.

### 1.4 La piste d'audit SQL sur Prisma

**Construite**, avec TypeORM : `PrismaAuditTrail` et `TypeOrmAuditTrail` (une classe chacun, piste
et lecteur) tenus à `auditTrailContract` et aux *specs* SQL des autres stockages,
`auditPrismaModels` et `auditEntities` prouvés créer les tables de `createAuditTables`,
`create-audit.ts.tpl` les reliant, le `TODO(platform)` gardé pour `custom` et sans ORM. Le texte
ci-dessous est le plan tel qu'il a été écrit.

`@ddd-ts-kit/audit` stocke sur Knex et Drizzle ; sur Prisma le projet généré démarre sur la
piste en mémoire derrière le `TODO(platform)` de `create-audit.ts.tpl` (ligne 131). À
construire : `PrismaAuditTrail` et `PrismaAuditReader` tenus à `auditTrailContract`, les modèles
dans `schema.prisma`, la chaîne de hachage et l'effacement d'un sujet (`auditedSubjectKeys`)
comme sur Knex, `create-audit.ts.tpl` les reliant avec Prisma et le `TODO(platform)` gardé pour
TypeORM et `custom` seulement.

Preuve : la suite de contrat d'audit sur Prisma ; la route `search-audit-entries` de la
plateforme dans l'exécution de bout en bout de l'exemple.

### 1.5 Le *preset* identity sur Nest, Prisma et le style explicite

`identity-refusal.ts` exige `style: declared`, `dependencies: signature`, `orm: knex|drizzle`,
`validation: zod|class-validator`, `http: express|fastify`, `authn: jwt|keycloak`,
`database: postgres`. Le *preset* compte 275 fichiers de gabarit : 29 variantes de persistance
(*mappers*, schémas de ligne, dépôts, `.knex.` et `.drizzle.`), 35 variantes de validation
(`.zod.` et `.class-validator.`, la seconde déjà écrite), le reste partagé.

À construire :

- les 29 fichiers de persistance sur Prisma (variantes `.prisma.` : *mappers* sur le client
  généré, dépôts avec `tenantWhere`, puisque le *preset* fait des organisations des *tenants*
  avec `--tenancy shared-table`, `organisations-as-tenants.ts`), et le fragment de
  `schema.prisma` des cinq agrégats (comptes, organisations, membres, invitations, délégations)
  avec les index uniques partiels sur lesquels le *preset* s'appuie, écrits comme Prisma les
  écrit (une étape de migration brute là où le langage de schéma ne peut pas) ;
- l'`identity.module.ts` explicite dont la famille manuelle a besoin : les liaisons que
  `kernelModule` et les déclarations font en style déclaré, écrites une fois dans le gabarit,
  comme `module.manual.ts.tpl` écrit un contexte vide ; le groupe de routes du *preset* monté
  par `create-app-module.ts.tpl` sur Nest ;
- `identity-refusal.ts` accepte `explicit` avec `nest` et `manual`, `prisma`, `http: nest` ; le
  guide [Démarrer avec des contextes bien conçus](../guides/bootstrap-with-well-designed-contexts.fr.md)
  dit ce qui a changé et garde ses raisons pour le reste (`dependencies: signature` reste, il n'a
  pas de sens en style explicite et n'y est pas lu).

Preuve : la spec de bout en bout du *preset* tourne sur `nest + class-validator + prisma + jest`
comme elle tourne sur la pile par défaut : le projet est vert tel que généré (vérificateur,
ESLint, dependency cruiser, knip, ses specs unitaires et de bout en bout), son contrat est à jour.

### 1.6 Jest dans la preuve du kit

`stacks.ts` laisse Jest hors des piles que le *workspace* exécute (« not installed in this
workspace »), si bien qu'un projet sur Jest est vérifié en types mais jamais exécuté par la
matrice. L'exemple est la première application sur Jest tenue verte en CI, avec le correctif
`process` de #233 derrière elle. La matrice du kit gagne une pile Jest exécutable (Jest installé
en dépendance de développement du *workspace*, une pile dans `RUNNABLE`), pour que la preuve ne
dépende pas de l'exemple seul.

### 1.7 Ce qu'`init` et les gabarits apprennent de l'exemple

L'exemple scheduling a été construit avec 213 exécutions de générateur et 27 refus, et son
rapport d'outillage liste environ 40 corrections à la main de code généré. Le second exemple est
construit de la même façon et tient le même rapport ; chaque correction à la main de code généré
sur cette pile est soit un défaut corrigé dans le kit dans la même série de *pull requests*,
soit une ligne du rapport qui dit pourquoi non. C'est la partie qu'on ne peut pas spécifier à
l'avance ; c'est pourquoi l'exemple est construit après la partie 1 et non en parallèle.

## Partie 2 : l'exemple

### 2.1 Énoncé des besoins

Écrit comme `examples/spend-management/docs/architecture/needs.md`, dans les mots de son
responsable produit, le directeur financier d'un groupe de sociétés qui donne cette plateforme à
ses salariés. La forme suit [celui de scheduling](../../examples/scheduling/docs/architecture/needs.fr.md) :
qui nous sommes, ce dont nous avons besoin en paragraphes numérotés, ce dont nous n'avons pas
besoin, comment nous jugerons. Le contenu, en bref :

1. **Dépenser selon une politique.** Chaque société fixe sa politique de frais : des catégories
   (déplacement, repas, hébergement, équipement, kilométrage), un plafond par catégorie et par
   jour, un justificatif exigé au-dessus d'un montant, un délai de soumission après la dépense,
   le kilométrage payé à un taux au kilomètre, des forfaits journaliers par pays. Une dépense
   dans une autre devise est convertie au taux de son jour. Un salarié dépose des notes de
   frais : une ou plusieurs lignes, chacune avec son justificatif, sa catégorie, sa date, son
   montant ; une note est soumise entière.
2. **Payer par carte.** La société donne à certains salariés une carte d'entreprise avec une
   limite mensuelle et des catégories autorisées. L'émetteur nous demande, en temps réel, si une
   autorisation est permise ; nous répondons en moins de deux secondes ou l'émetteur refuse. Une
   transaction réglée doit être rapprochée d'une ligne de frais avec son justificatif sous dix
   jours ; sinon le salarié est relancé, puis sa carte est gelée jusqu'à ce qu'il s'y conforme.
3. **Approuver.** Une note soumise est approuvée par le responsable du salarié ; au-dessus d'un
   seuil fixé par la société, par la finance aussi, dans cet ordre. Nul n'approuve sa propre
   note, ni la note de quelqu'un qui approuve les siennes. Un approbateur absent nomme un
   délégué pour une période. Une note qui attend plus de cinq jours ouvrés escalade au
   responsable de l'approbateur. Une note est approuvée entière, ou renvoyée avec les lignes à
   corriger, ou rejetée avec un motif.
4. **Tenir le budget.** Chaque société a des centres de coût avec un budget par période (mois ou
   trimestre) et par catégorie. Une note soumise engage son montant sur son centre de coût ; une
   note approuvée le consomme ; une note rejetée le libère. Les contrôleurs voient la
   consommation en direct et sont avertis à 80 pour cent et à 100 pour cent ; une note qui
   dépasserait un budget clos exige la finance quel que soit son montant. Une période se clôture
   à son dernier jour : plus d'engagement dessus, le reste rapporté.
5. **Rembourser.** Les notes approuvées d'un salarié sont payées à la prochaine campagne de
   paiement de sa société, hebdomadaire, par virement : un lot, un fichier pour la banque (SEPA
   pain.001), un statut par virement quand la banque répond, sous trois jours, sinon le virement
   est marqué inconnu et la finance prévenue. Les dépenses par carte ne sont pas remboursées ;
   elles sont rapprochées.
6. **Tenir les comptes.** Chaque dépense approuvée et chaque transaction de carte atterrit dans
   le grand livre de sa société comme écriture sur les comptes de son plan comptable ; le grand
   livre n'est jamais réécrit, une correction est une nouvelle écriture. Le comptable exporte
   les écritures d'une période vers le logiciel comptable, dans son format (CSV pour l'un, XML
   pour l'autre), et verrouille la période une fois exportée.
7. **Garder chaque société chez elle.** Un salarié voit ses notes et sa carte. Un responsable
   voit les notes de ses centres de coût. La finance et le comptable voient tout de leur société
   et rien d'une autre. Les opérateurs de la plateforme ouvrent les sociétés et les assistent, et
   lisent, n'écrivent jamais, l'élévation étant enregistrée.
8. **Prévenir les gens.** Le salarié apprend qu'une note a été approuvée, renvoyée, rejetée,
   payée ; l'approbateur qu'une note attend ; le contrôleur qu'un budget est à 80 pour cent ;
   chaque notification est dans l'application et, quand la personne le veut, par courriel, avec
   un résumé quotidien à la place quand elle le demande.

Ce dont on n'a pas besoin : la réservation de voyages, une application mobile, les bons de
commande et les fournisseurs (une seconde étape), la récupération de TVA.

### 2.2 Contextes

Sept contextes délimités, issus de la découverte (`discovery.md`) et des tests de frontière de
[Contexte délimité](../concepts/bounded-context.fr.md) ; `contexts.md` consigne les découpes
rejetées (les cartes comme module des frais, l'approbation dans les frais, la comptabilité dans
les budgets).

| Contexte | Nature | Ce qu'il porte | Modules |
|---|---|---|---|
| `identity` | générique, **le *preset*** | comptes, organisations (une organisation est une société, un *tenant*), membres et leur rôle, délégations | tels qu'écrits par le *preset* |
| `expenses` | cœur | la politique de frais d'une société, les notes de frais et leurs lignes, les justificatifs (fichiers dans S3), la conversion de devise au taux du jour, la soumission, le renvoi, le cycle de vie d'une note | `policy`, `reports`, `receipts` |
| `approval` | cœur | un dossier d'approbation par note soumise, la chaîne (le responsable, puis la finance au-dessus du seuil), les délégations d'approbation pour une période, l'escalade après cinq jours ouvrés (un gestionnaire de processus avec échéance), la décision | aucun |
| `cards` | support | les cartes d'entreprise, leurs limites, l'autorisation en temps réel de l'émetteur (couche anticorruption, une projection répondue sous deux secondes), les transactions réglées, le rapprochement avec une ligne de frais, les relances et le gel | `authorizations`, `matching` |
| `budgets` | support | les centres de coût, les budgets par période et catégorie, engagements et consommation, les alertes, la clôture d'une période à son dernier jour | aucun |
| `reimbursement` | support | les campagnes de paiement, les lots de virements, le fichier SEPA (XML par négociation de contenu), le statut répondu par la banque (un gestionnaire de processus avec échéance de trois jours), les coordonnées bancaires des salariés | aucun |
| `accounting` | support | le plan comptable d'une société, le grand livre gardé comme ses événements (*event sourcing* par agrégat), les écritures, l'export d'une période (CSV, XML), le verrouillage d'une période | `ledger`, `export` |
| `notification` | générique | une notification par événement et destinataire, les préférences de canal, le résumé quotidien ; la forme de celui de scheduling, réécrite dans les mots de ce métier | aucun |

La carte des contextes (`context-map.md`) nomme chaque paire ; la forme en une ligne : `identity`
est en amont de tout (langage publié, les organisations comme *tenants*) ; `expenses` est en amont
d'`approval` (client-fournisseur : le dossier est ouvert pour une note soumise et la décision
revient), de `budgets`, `reimbursement`, `accounting` et `notification` (langage publié) ;
`cards` est en amont d'`expenses` (une transaction réglée devient une ligne à rapprocher) et
d'`accounting` ; `approval` est en amont d'`expenses` (conformiste : la note prend la décision
telle quelle), de `budgets` et `reimbursement` ; `reimbursement` d'`accounting` et
`notification` ; `budgets` de `notification`. Pas de cycle : `approval` répond à `expenses` par
un événement, jamais par une commande.

### 2.3 Pile

La commande, telle que `plan.md` la consigne ; dans ce dépôt la CLI est
`node ../../packages/cli/dist/bin.js`, lancée depuis `examples/spend-management` :

```bash
npx ddd-ts-kit init --http nest --di nest --validation class-validator --tests jest \
  --orm prisma --database postgres --events outbox --broker kafka --cache redis --queue database \
  --storage s3 --tenancy shared-table --authn keycloak --authz abac --audit on \
  --errors sentry --logger winston --docs-ui scalar --ci github \
  --representations negotiated --forms on --sdk --package-manager npm \
  --context identity:generic --preset identity \
  --context expenses:core --context approval:core --context cards:supporting \
  --context budgets:supporting --context reimbursement:supporting \
  --context accounting:supporting --context notification:generic --json
```

Chaque valeur face à celle de scheduling, et pourquoi :

| Décision | Scheduling | Gestion des dépenses | Pourquoi |
|---|---|---|---|
| HTTP, conteneur, style | Express, tsyringe, déclaré | **NestJS, son conteneur, explicite** (`init` impose `explicit` avec `--di nest`) | le framework TypeScript le plus utilisé ; l'exemple montre ce que coûtent des routes indépendantes du framework avec Nest et ce que Nest donne encore (ses modules pour la santé et les métriques) |
| Validation | class-validator | class-validator | celle de Nest ; le mode décorateurs hérité sur tout le programme, comme sur scheduling |
| Tests | Vitest | **Jest** | le défaut de Nest et le lanceur le plus utilisé ; première application sur Jest tenue verte |
| ORM, base | Knex, PostgreSQL | **Prisma**, PostgreSQL | l'ORM TypeScript le plus utilisé ; PostgreSQL reste, voir MySQL plus bas |
| Événements, *broker* | outbox, Redis Streams | outbox, **Kafka** (KRaft, un nœud) | le *broker* le plus utilisé ; le *fake* de `@ddd-ts-kit/kafka` exécute les specs, le vrai serveur tourne dans un *job* de CI |
| Cache, file | Redis (Dragonfly), base | **Redis (Valkey dans compose)**, base | `--queue database` est ce que 1.1 et 1.3 rendent possible ; le cache porte les taux du jour et le limiteur de débit du *webhook* |
| Cache HTTP | Varnish | **aucun** | aucune lecture publique dans ce métier : chaque réponse est par acteur et par société ; un cache partagé ne montrerait rien |
| Stockage | local | **S3** (MinIO dans compose) | les justificatifs et les fichiers de banque et d'export |
| *Tenancy* | table partagée | table partagée | une organisation est une société ; ce que 1.2 rend possible sur Prisma |
| Authentification | Keycloak | Keycloak | le seul fournisseur que la pile compose a ; le *preset* mappe ses *claims* |
| Autorisation | ReBAC, avec rôles | **ABAC, par-dessus les rôles** | les règles portent sur des montants, des centres de coût, des seuils et des personnes (auto-approbation) ; l'ADR 0001 dit comment une liste est restreinte, un prédicat n'étant pas une requête |
| Audit, erreurs, *logger* | on, GlitchTip, pino | on, GlitchTip, **Winston** | l'audit sur Prisma est ce que 1.4 rend possible ; Winston est le *logger* le plus téléchargé |
| Interface de documentation | Swagger | **Scalar** | l'autre interface du kit, jamais montrée |
| CI | les deux | GitHub | la porte de l'exemple tourne dans le *pipeline* de ce dépôt ; le *pipeline* GitLab est prouvé par scheduling |
| Représentations, formulaires | négociées, on | négociées, on | le fichier SEPA et l'export comptable sont le XML et le CSV des mêmes routes ; les formulaires de la politique de frais sont servis au client |
| Gestionnaire de paquets | npm | npm | l'exemple est un *workspace* du *workspace* npm de ce dépôt, comme scheduling ; `pnpm` est prouvé par la matrice générée |
| Refus, routes, schémas, objets-valeurs, littéraux, valeurs | les défauts | les défauts | rien à prouver de nouveau |

### 2.4 Les capacités du kit, chacune en un lieu

La table par laquelle s'ouvre le README de l'exemple : un lecteur cherche une capacité et ouvre
un dossier. `<c>` désigne `src/contexts`.

| Capacité | Où elle est exercée |
|---|---|
| agrégats, objets-valeurs, machines à états | `ExpenseReport` et son cycle de vie (brouillon, soumise, renvoyée, approuvée, rejetée, payée), `Money` avec devise et arrondi, `Mileage`, `ApprovalCase`, `Budget`, `Card` |
| modules du modèle | `expenses` (`policy`, `reports`, `receipts`), `cards`, `accounting` |
| politiques (ABAC), permissions sur le cas d'usage | `approval` : nul n'approuve sa propre note ni la note de quelqu'un qui approuve les siennes ; un responsable jusqu'au seuil de la société, la finance au-dessus ; `expenses` : un salarié lit les siennes, un responsable ses centres de coût, la finance tout ; `budgets` : un contrôleur du centre de coût ; le refus explicite d'une carte gelée |
| portée d'accès sur une recherche | les notes qu'un responsable liste sont celles de ses centres de coût : les attributs de l'acteur deviennent la portée de la recherche, pas un filtre après coup (ADR 0001) |
| multi-tenant | une organisation est un *tenant* ; les opérateurs lisent avec l'élévation enregistrée ; l'*outbox* porte le *tenant* à chaque consommateur |
| stockage de fichiers | les justificatifs (préparés avant la transaction, déplacés avec le *commit*, servis par liens signés), le fichier SEPA et le fichier d'export écrits par des tâches de fond |
| événements d'intégration, *outbox*, Kafka, consommateurs idempotents | quatorze événements ou plus à travers sept contextes ; un `approval.decision.taken` relivré n'approuve jamais deux fois |
| couche anticorruption, passerelle, *webhook* | la demande d'autorisation et le *webhook* de règlement de l'émetteur (`cards`), idempotents par l'identifiant de l'émetteur, répondus depuis une projection des limites sous deux secondes, avec échéance et disjoncteur sur l'API propre de l'émetteur ; le fournisseur de taux de change (`expenses`) derrière une passerelle, en cache par jour |
| gestionnaires de processus avec échéances | l'escalade d'une approbation après cinq jours ouvrés ; le statut d'un lot de paiement sous trois jours |
| tâches de fond | le fichier SEPA d'un lot, l'export d'une période, le résumé quotidien, la conversion des lignes d'une note à la soumission |
| tâches planifiées | la campagne de paiement hebdomadaire, la clôture d'une période à son dernier jour, les relances et gels des transactions non rapprochées, la purge des fichiers préparés |
| *event sourcing* par agrégat | le grand livre d'une société (`accounting`) : les écritures sont ses événements, une correction est une nouvelle écriture, les projections donnent les soldes ; un *upcaster* quand l'écriture gagne un champ |
| projections et modèles de lecture | les soldes du grand livre, la consommation d'un budget, les limites d'une carte, les notes en attente d'un approbateur |
| représentations par négociation de contenu | `GET /payout-batches/:id/file` en XML (pain.001), `GET /periods/:id/export` en CSV ou XML ; la même route, un schéma |
| formulaires décrits par le serveur | la politique de frais d'une société, éditée par le formulaire que le serveur décrit ; les champs réservés à la finance cachés à un responsable |
| piste d'audit | chaque commande, les refus des gardes à la frontière, l'élévation d'un opérateur ; la route de recherche de la plateforme |
| résilience | `@Retry` et `@Timeout` sur l'émetteur et la banque, un disjoncteur sur le fournisseur de taux, le limiteur de débit sur le *webhook* |
| observabilité | une trace du *webhook* à l'écriture du grand livre ; Winston vers stdout ; GlitchTip pour les échecs |
| client typé | le SDK généré, utilisé par le script de démonstration |
| extractibilité | `cards` a son propre point d'entrée (`generate service`) et son test de démarrage, c'est le contexte qu'une société ferait monter en charge seul |

### 2.5 Enregistrements de décision

Écrits à mesure que le travail les soulève ; quatre sont connus dès maintenant.

| ADR | Décision |
|---|---|
| 0001 | ABAC par-dessus les rôles, et comment une liste est restreinte : les attributs de l'acteur (centres de coût, rôle, société) deviennent une portée d'accès que la recherche applique, les politiques décident sur un élément ; un prédicat pur ne filtre jamais une page |
| 0002 | une organisation est un *tenant* (comme le 0003 de scheduling, dans ce métier : une société, ses centres de coût, sa politique) |
| 0003 | le grand livre est gardé comme ses événements, les autres agrégats comme leur état : ce que cela achète ici (une correction est une écriture, les soldes sont des projections) et ce que cela coûte (l'*upcaster*, la reconstruction) |
| 0004 | une autorisation de carte est répondue depuis une projection des limites, pas depuis l'agrégat : deux secondes, la relance propre de l'émetteur, le règlement qui rapproche plus tard |

### 2.6 Comment il est construit

Le même chemin que scheduling, pour que les deux rapports d'outillage se comparent : besoins,
découverte, contextes, glossaire de chaque contexte (`CONTEXT.md` d'abord, 80 à 100 termes), la
carte provisoire, `init` avec la commande ci-dessus, les contrats et squelettes *committés* par le
conducteur (agrégats, dépôts, événements d'intégration avec leurs charges, passerelles,
politiques, les tâches), les tranches (`slices.md`, une ligne par cas d'usage, contrats d'abord),
les consignes, un *worker* par contexte dans un *worktree* git, l'ordre de fusion fixé par la
carte des contextes, l'intégration sur le tronc, une porte verte, puis l'exécution réelle
enregistrée dans `demo-transcript.md`.

*Workers* : sept, un par contexte, `identity` étant le *preset* plus son glossaire (la plus
petite consigne), `expenses` le plus gros (ses trois modules peuvent être deux *workers*, comme
scheduling a coupé `scheduling` en deux). Le travail de plateforme (le module d'application Nest
avec les routes du kit montées, santé et métriques en modules Nest natifs, le groupe de
consommateurs Kafka, MinIO, le *realm* Keycloak avec les rôles et les attributs des utilisateurs
de démonstration) est un *worker* à part, en premier.

Tailles, comme cible face aux 32 commandes et requêtes, 25 routes, 14 événements d'intégration
de scheduling : environ 45 commandes et requêtes, 35 routes, 18 événements d'intégration,
3 gestionnaires de processus, 6 tâches planifiées, 5 tâches de fond, 8 projections,
6 politiques.

Le rapport d'outillage (`tooling-report.md`) garde les mêmes sections que celui de scheduling :
chiffres de tête, temps par phase, exécutions de générateur par sorte, corrections à la main de
code généré, frictions classées, contradictions, défauts du kit avec reproductions, ce qui n'a
pas été construit. Sa première section dit ce que la pile a changé face à celle de scheduling,
Nest, Prisma et Jest en particulier.

### 2.7 Démonstration et exécution réelle

Le `docker-compose.yml` de l'exemple : PostgreSQL, Valkey, Kafka (KRaft), Keycloak avec le
*realm* de la démonstration, MinIO, Jaeger, GlitchTip. Un script joue le scénario de la
transcription avec de vrais jetons : une société est ouverte, sa politique fixée, une carte
donnée ; un salarié dépose une note avec deux justificatifs et une ligne de kilométrage, une
transaction de carte est réglée et rapprochée ; le responsable approuve, la finance est requise
par le montant ; le budget atteint 80 pour cent ; la campagne de paiement paie le salarié ; le
fichier SEPA est lu en XML ; le grand livre montre les écritures ; la période est exportée en
CSV et verrouillée ; la recherche d'audit montre l'opérateur qui l'a lue. Un second script simule
l'émetteur (*webhooks* d'autorisation et de règlement) et la banque (statuts), puisque ni l'un
ni l'autre ne peut être dans la pile compose. La transcription est la sortie enregistrée.

## Partie 3 : le dépôt

- `examples/spend-management` rejoint le *workspace* npm (`examples/*` correspond déjà) ; la
  racine gagne `example:verify:spend-management`, `example:verify` lance les deux, et le *job* de
  CI `example` devient un *job* par exemple (l'étape Varnish reste sur scheduling ; le nouveau a
  une étape Kafka et une étape MinIO, et les specs d'adaptateur Prisma sur le serveur PostgreSQL
  comme scheduling lance ses specs Knex).
- La suite de conformité tourne aussi sur le second exemple, puisque ses règles rencontrent des
  dépôts Prisma, un module explicite et des routes Nest : chaque règle cassée une fois dans une
  copie, signalée sur le fichier qui la casse ; la branche Prisma de `tenancy/scoped-statement`
  de 1.2 est prouvée ici.
- `examples/README.md` devient l'index de deux exemples : la table de ce que chacun montre, avec
  la pile de chacun côte à côte, et une requête suivie à travers le code du second (une
  autorisation de carte : le *webhook*, la couche anticorruption, la projection, la réponse, puis
  le règlement et le rapprochement).
- `docs/README.md` et le site listent les documents du second exemple comme ils listent le
  premier ; chaque page en français.
- Les notes de version (`changes/`) de chaque *pull request* de la partie 1 disent ce qu'un
  projet gagne ; l'exemple lui-même tient en une ligne.

## Ce qui est laissé de côté, et pourquoi

**MySQL (et SQLite en production).** `init` refuse une autre base que PostgreSQL avec les quatre
ORM, et ce refus est gardé pour cet exemple. PostgreSQL est la base la plus utilisée avec Prisma
et la seule dans les suites automatisées de chaque adaptateur
([Persistance, par base](../tools/persistence.fr.md#par-base-de-données)) ; l'exemple dessus
prouve la pile que les gens font réellement tourner. Ce que MySQL demanderait n'est pas petit et
est listé pour que ce soit une décision d'une proposition ultérieure, pas un manque trouvé à
l'`init` : un dialecte de la persistance générée (`ON CONFLICT` vers `ON DUPLICATE KEY`, `jsonb`
vers `json`, un schéma par contexte vers un préfixe de table ou une base, `SKIP LOCKED` sur 8.0
seulement), les magasins des *packages* ORM sur MySQL 8 en CI là où ils sont lancés à la main
une fois aujourd'hui, le magasin d'événements du noyau
(`packages/kernel/src/infrastructure/event-sourcing/postgres/`) réécrit sans index partiels ni
`RETURNING`, les index uniques partiels du *preset* identity, la piste d'audit SQL, et un second
vrai serveur dans chaque *job* d'intégration.

**Un cache HTTP.** Rien dans ce métier n'est public ; un cache par acteur est le cache du noyau,
que l'exemple emploie pour les taux du jour.

**OpenFGA, SpiceDB.** ABAC est le propos ; les moteurs de relations sont montrés par scheduling et
leur page.

**L'import d'un fichier.** Le plan comptable pourrait être importé d'un CSV, ce qui est
exactement la [conception de l'import de fichiers](../concepts/file-import-export.fr.md), non
construite. L'exemple ne la construit pas ; si la conception est construite plus tard, c'est ici
qu'elle serait montrée.

**De vraies intégrations.** Pas de vrai émetteur de cartes, de banque ni de logiciel comptable :
les couches anticorruption sont écrites contre les formats publics (champs ISO 8583 d'une
autorisation en JSON, pain.001.001.09, un CSV que les logiciels comptables courants lisent) et
les simulateurs de la démonstration.

## Décisions à confirmer avec le propriétaire du dépôt

Prises ici, à confirmer ou changer avant de lancer `init` ; chacune est une ligne de `plan.md` :

1. Kafka plutôt que RabbitMQ (les deux existent dans le kit, Kafka est le plus demandé, RabbitMQ
   est déjà dans la matrice générée).
2. Keycloak gardé comme fournisseur (le *preset* et la pile compose le connaissent) ; un
   fournisseur OIDC ordinaire montrerait `--authn jwt` mais la pile compose n'en a aucun.
3. Sept contextes, `cards` et `accounting` comme contextes et non comme modules d'`expenses`
   (leur langage et leurs systèmes externes diffèrent) ; `notification` écrit avec les
   générateurs sans attendre un *preset* ([Presets de contextes](context-presets.fr.md) dit que
   notification est le prochain : cet exemple est la seconde application à l'écrire, ce qui est
   la matière de ce *preset*).
4. Le nom `spend-management` pour le dossier, le *workspace* et les pages.
5. La partie 1 en cinq *pull requests* dans l'ordre 1.1, 1.2, 1.3, 1.4, 1.5 (1.6 avec 1.5),
   chacune avec ses suites de contrat et sa ligne de la matrice ; la partie 2 commence quand
   `init --dry-run` avec la commande de 2.3 passe.

## Voir aussi

- [Exemples](../../examples/README.fr.md) : le premier exemple, et comment il a été construit.
- [Presets de contextes](context-presets.fr.md) : le *preset* identity, et notification comme
  prochain.
- [Frameworks HTTP](../tools/http-frameworks.fr.md) : ce que coûtent des routes indépendantes du
  framework avec Nest.
- [Persistance](../tools/persistence.fr.md) : les quatre ORM, par base.
- [Authentification et autorisation](../concepts/authentication-and-authorization.fr.md) : ABAC,
  et pourquoi un prédicat n'est pas une requête.
- [Multi-tenant](../concepts/multitenancy.fr.md) : la table partagée, l'*outbox* avec le *tenant*.
