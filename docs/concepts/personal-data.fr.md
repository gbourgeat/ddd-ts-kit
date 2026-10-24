[English](personal-data.md) · **Français**
<!-- translation-of: personal-data.md sha256:79a1e6625d8645ec -->

# Les données personnelles dans un projet généré

**Résumé.** Un projet généré sait lesquelles de ses colonnes tiennent des données personnelles, et
efface une personne de toutes d'une seule commande. `init` écrit le dossier *privacy* de la
plateforme (`--privacy on`, le défaut avec un ORM) : les listes des copies et des exports que chaque
contexte déclare, et les scripts `privacy:erase` et `privacy:export`. `generate repository <context>
<Aggregate> --personal <colonne>,...` déclare ce qu'une table garde d'une personne, à côté de son
*mapper*, et écrit une fois par contexte l'effacement et l'export qui lisent chaque déclaration :
deux ports, leurs adaptateurs sur ceux du paquet d'ORM, leurs *fakes*, une *spec* et leurs lignes
dans les copies et les exports de la plateforme. Avec `--event-sourcing on`, la clé de la personne dans l'event store est détruite d'abord,
pour que ses événements stockés se lisent effacés. Ce sont les mécanismes de la protection des
données dès la conception, intégrés par défaut ; ce qu'un outil ne peut pas décider, la base légale
d'un traitement ou la complétude d'une déclaration, reste au projet, et cette page le dit. Les pièces
du kit sur lesquelles cette page repose : [Event sourcing](event-sourcing.fr.md#données-personnelles--crypto-shredding)
pour le scellement des événements stockés, [Journal d'audit](audit-trail.fr.md#le-droit-à-leffacement-et-une-chaîne-en-ajout-seul)
pour la preuve datée, [Multi-tenant](multitenancy.fr.md) pour ce qu'un *tenant* confine.

![L'effacement d'une personne dans un projet généré : le script appelle runErasure de la plateforme, qui donne à eraseDataSubject du noyau la clé de la personne, chaque copie listée dans data-subject-copies.ts, un port par contexte dont l'adaptateur efface les tables déclarées par personalFields, et les projections à reconstruire ; le rapport compte les lignes atteintes par contexte ; en bas, ce que generate repository --personal écrit](../assets/diagrams/personal-data-erasure.fr.svg)

## Ce qu'un projet généré contient

| Écrit par | Quoi | Où |
|---|---|---|
| `init --privacy on` (`on` avec un ORM, `off` sans ou sur demande) | les listes des copies et des exports que les contextes déclarent, `runErasure`, `runExport` et `runPurge`, le *job* de nuit `privacy.purge-expired`, les trois scripts | `src/platform/privacy/`, `scripts/privacy-erase.ts`, `scripts/privacy-export.ts`, `scripts/privacy-purge.ts` |
| `init --event-sourcing on` (`off` sauf demande) | l'event store, les clés des personnes concernées et le chiffre qui scelle une valeur personnelle d'un événement stocké, audités quand le journal est actif | `src/platform/event-sourcing/`, le schéma `event_store` |
| `generate repository <ctx> <Aggregate> --personal <colonne>,...` | les colonnes dans le stockage, leur déclaration, et une fois par contexte l'effacement et l'export qui la lisent | le contexte |

Un projet sans donnée personnelle prend `--privacy off` et ne paie rien ; un projet dont tous les
agrégats sont des lignes garde `--event-sourcing off` et ne paie aucune table pour cela. Les deux
sont enregistrés dans la configuration (`stack.privacy`, `stack.eventSourcing`) et changés plus tard
par `init --force` ([CONFIG.fr.md](../CONFIG.fr.md)).

## Déclarer ce qu'une table garde d'une personne

```bash
npx ddd-ts-kit generate repository billing Customer --personal email,display_name
npx ddd-ts-kit generate repository billing Invoice --personal customer_email --subject customer_id --erasure row
```

La première commande déclare que la table `customers` garde l'email et le nom affiché de la personne
dont la ligne parle, nommée par son `id` : un effacement les pseudonymise, la ligne reste et chacun
se lit `[erased]`. La seconde déclare que la table `invoices` copie l'email d'un client, nommé par
`customer_id`, et qu'un effacement supprime ces lignes. Chaque commande :

- ajoute les colonnes à la table et au type de ligne de l'agrégat, en texte nullable ; le *mapper*
  les écrit vides, avec une note, tant que l'agrégat ne les porte pas (un objet-valeur `Email`, un
  champ de l'état) ;
- écrit la déclaration `infrastructure/persistence/<agrégat>.personal-fields.ts` à côté du
  *mapper*, avec `personalFields` du kernel, épelée comme l'effacement de l'ORM la lit : les noms SQL
  sur Knex et Prisma, les propriétés de la définition sur Drizzle et TypeORM ;
- la première fois dans un contexte, écrit son effacement : le port
  `application/ports/<contexte>-personal-data-erasure.port.ts`, une classe abstraite qui étend
  `PersonalDataErasure` du kernel ; l'adaptateur
  `infrastructure/persistence/<orm>-<contexte>-personal-data-erasure.repository.ts`, qui étend
  l'effacement du paquet d'ORM (`KnexPersonalDataErasure`, `DrizzlePersonalDataErasure`,
  `PrismaPersonalDataErasure`, `TypeOrmPersonalDataErasure`) avec les déclarations du contexte,
  confiné au *tenant* du travail quand le *repository* l'est ; son *fake* ; une *spec* qui enregistre
  deux personnes par le *repository*, écrit leurs colonnes personnelles et prouve l'effacement et
  l'export sur la base de test ; et sa liaison, le décorateur `@Repository` en style déclaré, le
  fichier module d'un contexte explicite, la fabrique d'une plateforme câblée à la main ;
- la première fois dans un contexte aussi, écrit son export : le port
  `application/ports/<contexte>-personal-data-export.port.ts`, qui étend `PersonalDataExport` du
  kernel ; l'adaptateur `infrastructure/persistence/<orm>-<contexte>-personal-data-export.repository.ts`,
  qui étend l'export du paquet d'ORM (`KnexPersonalDataExport`, `DrizzlePersonalDataExport`,
  `PrismaPersonalDataExport`, `TypeOrmPersonalDataExport`) avec les mêmes déclarations, confiné au
  *tenant* de la même façon ; son *fake* ; lié de la même façon ;
- liste les deux ports une fois, dans `src/platform/privacy/data-subject-copies.ts` et
  `data-subject-exports.ts`, entre les marqueurs ; `init --force` les liste de nouveau quand il
  réécrit les fichiers ;
- une table ultérieure du même contexte rejoint les `declarations` des deux adaptateurs, entre
  marqueurs.

```ts
// infrastructure/persistence/customer.personal-fields.ts, tel que généré sur Knex
const TABLE = { schema: BILLING_SCHEMA, table: 'customers' };

const declaration: PersonalFieldsOptions<CustomerRow> = {
  subject: 'id',
  fields: ['email', 'display_name'],
  erasure: 'pseudonymise',
};

export const CustomerPersonalFields = personalFields(TABLE, declaration);
```

La colonne du sujet nomme la personne concernée dont une ligne parle, un identifiant opaque : `id`
quand la ligne est la personne, la colonne qui tient l'id de la personne sinon. Elle n'est jamais une
donnée personnelle elle-même, et le générateur refuse un sujet listé dans `--personal`. Les colonnes
sont données par leur nom SQL, lettres minuscules, chiffres et tirets bas ; une colonne que la table
générée garde pour elle (`id`, `version`, `registered_at`, `tenant_id`, les colonnes d'audit) est
refusée, comme un projet sans dossier *privacy* (`init --force --privacy on`) ou sans paquet d'ORM qui
livre l'effacement (`--orm none`, `--orm custom`).

Les deux modes, fixés par table :

| `--erasure` | Ce que lisent ensuite les lignes de la personne | Quand |
|---|---|---|
| `pseudonymise` (le défaut) | la ligne reste, chaque colonne personnelle de texte se lit `[erased]`, toute autre colonne personnelle ne lit rien (elle doit accepter null) | une ligne vers laquelle d'autres pointent, un fait du métier qui nomme la personne par un id opaque |
| `row` | les lignes de la personne sont supprimées | une pure copie de la personne, un contact, une entrée de carnet d'adresses |

## L'effacement, de bout en bout

`npm run privacy:erase -- <subject-id> [--operator <qui-demande>]` tourne sur les sources avec les
variables de `.env`. Le script ouvre la persistance, compose l'application, ouvre un contexte
d'exécution d'origine `cli` avec l'opérateur pour acteur, et lance `eraseDataSubject` du kernel sur :

1. la clé de la personne, quand le projet a un event store : détruite, pour que chaque événement
   stocké de la personne se lise `[erased]` au prochain rejeu, et auditée quand le journal est actif ;
2. chaque copie listée dans `data-subject-copies.ts`, un port par contexte, résolu depuis
   l'application : chaque adaptateur efface ou pseudonymise les lignes de ses tables déclarées, dans
   le *tenant* du travail ; avec `--tenancy shared-table`, `TENANTS` nomme les *tenants*, séparés par
   des virgules, et une copie est jouée une fois par *tenant*, puisqu'une écriture de données de
   *tenant* n'est jamais élargie ;
3. les projections alimentées par le store, reconstruites une fois la clé détruite : données à la
   main pour l'instant, là où le lanceur dit `TODO(platform)`.

Il imprime le rapport en JSON : si une clé a été détruite, les lignes que chaque contexte a atteintes,
les projections reconstruites. Une copie qui échoue n'arrête pas les autres, et le premier échec est
levé une fois que tout a tourné : relancer l'effacement achève celui qui a échoué à mi-chemin,
n'atteint plus rien la deuxième fois et le dit. Un sujet qui n'est pas un identifiant opaque (un nom,
un email) est refusé avant que quoi que ce soit ne soit touché.

Une fois chaque copie effacée, `runErasure` publie `privacy.data-subject.erased` par l'outbox
(`dataSubjectErasedV1` du kernel, `{ subjectId, erasedAt }` : l'id de la personne et de personne d'autre, l'opérateur restant dans le journal d'audit auquel mène son id de corrélation ; des identifiants
seulement), une fois par *tenant* avec des tables partagées ; le relais de l'application en marche
le livre. Un effacement qui a échoué ne publie rien, et le relancer le fait. C'est ainsi que
l'article 19 porte au-delà de la base que tient la plateforme :

- un contexte extrait en service à part efface sa copie de son côté : `npx ddd-ts-kit generate
  erasure-handler <context>` écrit le *handler* idempotent de l'événement sur l'effacement du
  contexte, sa *spec* sur le *fake* et son abonnement (le décorateur, le fichier module, ou la
  plateforme câblée à la main, dans une transaction derrière un *broker*). Dans le monolithe, la
  plateforme a déjà effacé cette copie, et le *handler* n'atteint rien : un effacement est
  idempotent ;
- un système hors du projet qui consomme les événements du projet, et a copié la personne depuis
  l'un d'eux, s'abonne au même type : le catalogue des événements et AsyncAPI le listent ;
- un événement d'intégration qui porte des données personnelles le dit (`personal: { subject,
  fields }` sur `defineIntegrationEvent`) : le catalogue l'écrit sous la charge utile, AsyncAPI en
  `x-personal-data`, pour que chaque consommateur sache quelle copie il garde
  ([`@ddd-ts-kit/events`](../../packages/events/README.fr.md#les-données-personnelles-dune-charge-utile)).

Dans une *spec* de gestionnaire, le *fake* de l'effacement (`Fake<Contexte>PersonalDataErasure`)
compte les lignes qu'il tient d'une personne et les oublie au premier effacement, comme le *fake* d'un
*repository*.

## L'export, de bout en bout

![L'export d'une personne dans un projet généré : le script appelle runExport de la plateforme, qui donne à exportDataSubject du noyau chaque export listé dans data-subject-exports.ts, un port par contexte dont l'adaptateur lit les tables déclarées par personalFields ; chaque export est enveloppé par auditedPersonalDataExport quand le journal est actif ; le résultat est un document daté, imprimé en JSON](../assets/diagrams/personal-data-export.fr.svg)

`npm run privacy:export -- <subject-id> [--operator <qui-demande>] > export.json` répond au droit
d'accès et à la portabilité (RGPD, articles 15 et 20) de la même façon : le script compose
l'application, ouvre un contexte d'exécution d'origine `cli` avec l'opérateur pour acteur, et lance
`exportDataSubject` du kernel sur chaque export listé dans `data-subject-exports.ts`, un port par
contexte, dans chaque *tenant* nommé par `TENANTS` avec des tables partagées, puisqu'une lecture de
données de *tenant* est confinée à son *tenant* comme une écriture. Chaque adaptateur lit les mêmes
déclarations que l'effacement et répond un enregistrement par ligne sur la personne, sous
`<contexte>.<table>`, avec les colonnes personnelles et les clés des fichiers en données simples,
aucune autre colonne et rien de personne d'autre ; une ligne déjà pseudonymisée se lit `[erased]`, une
ligne supprimée ne répond rien. Le résultat est un document :

```json
{
  "format": "ddd-ts-kit/personal-data-export@1",
  "subject": "cus_42",
  "exportedAt": "2026-10-24T09:30:00.000Z",
  "records": [
    { "source": "billing.customers", "values": { "email": "ada@example.org", "display_name": "Ada" } },
    { "source": "billing.invoices", "values": { "customer_email": "ada@example.org" } },
    { "source": "crm.contacts", "values": { "email": "ada@example.org", "phone": null } }
  ]
}
```

Structuré, couramment utilisé et lisible par machine, comme le demande l'article 20 ; daté, pour que
ce qu'il affirme soit vrai de cet instant ; nommé par son format, pour qu'un lecteur en connaisse la
forme et distingue une forme ultérieure ; nommant la personne par le seul id opaque. Remettez-le à la
personne, puis supprimez le fichier. Les exports tournent dans l'ordre listé, pour qu'un document se
lise pareil d'une exécution à l'autre, et celui qui échoue arrête le rassemblement : un document
auquel un contexte manquerait en silence affirmerait moins que ce que le système garde. Un sujet qui
n'est pas un identifiant opaque est refusé avant toute lecture : un export cherche une personne par
son id, jamais par un nom ou un email, ce qui serait une recherche dans des données personnelles.

Avec `--audit on`, `runExport` enveloppe chaque port avec `auditedPersonalDataExport` de
`@ddd-ts-kit/audit` : une entrée par contexte, catégorie `data-access`, action `personal-data:export`,
l'opérateur, la personne, le contexte et le nombre d'enregistrements, jamais les valeurs, écrite
avant que les enregistrements ne soient remis, pour qu'aucun document ne parte sans sa trace. C'est
la responsabilité de l'article 5(2) appliquée au droit d'accès : qui a lu quoi de qui, et quand
([Journal d'audit](audit-trail.fr.md#le-droit-à-leffacement-et-une-chaîne-en-ajout-seul)). Le journal
est en ajout seul : chaque exécution est une remise et laisse son entrée, un essai compris ; essayez
le script sur une personne de test, jamais sur une vraie.

Dans une *spec* de gestionnaire, le *fake* de l'export (`Fake<Contexte>PersonalDataExport`) remet les
enregistrements qu'un test lui a donnés et se souvient de qui a été demandé.

## La conservation, chaque nuit

```bash
npx ddd-ts-kit generate repository billing Customer --personal email,display_name --retention ended_at:36m
```

`--retention <colonne>:<n><d|m|y>` dit combien de temps les lignes gardent la personne (RGPD,
article 5(1)(e)), compté depuis une colonne de date de la ligne : `registered_at`, que chaque table
générée possède, ou une colonne à vous, `ended_at` ci-dessus, qui rejoint le stockage en horodatage
nullable, vide tant que le fait qu'elle date n'est pas arrivé ; une ligne dont la date est vide
n'expire jamais. La déclaration gagne `retention: { after: 'ended_at', months: 36 }`, et la *spec*
générée prouve la purge sur la base de test. Une colonne personnelle, le sujet et les colonnes que
la table garde pour elle sont refusés comme départ d'une conservation, de même qu'une période qui
n'est pas une unité positive.

Chaque nuit à 03:00 UTC, le *job* `privacy.purge-expired` de la plateforme lance `runPurge` : chaque
copie listée dans `data-subject-copies.ts` efface, comme sa déclaration le dit, les lignes qui ont
dépassé leur durée de conservation, dans chaque *tenant*, puisque le travail d'un *job* n'en nomme
aucun et qu'un *tenant* oublié dans une liste garderait ce qu'il ne doit pas ; avec `--audit on`,
chaque copie laisse une entrée `personal-data:purge` avec le nombre de lignes, `0` compris, et
aucune personne. `JOB_PRIVACY_PURGE_EXPIRED_ENABLED=false` coupe le *job* dans un environnement, et
`npm run privacy:purge` le lance à la main et imprime les lignes atteintes par contexte. Une table
dont la déclaration ne donne aucune durée garde ses lignes jusqu'à ce que la personne le demande.

Combien de temps est une décision du projet, pas de l'outil : la durée qu'une loi impose
(comptabilité, santé), ou celle dont la finalité a besoin. Écrivez-la au registre avec sa raison.

## Ce qui reste hors de portée

- **Les sauvegardes et la rétention du *broker*.** Un effacement atteint la base de données, jamais
  une sauvegarde ni un message déjà publié : la borne d'un effacement est une date, que la politique
  de rétention décide. L'annonce atteint les consommateurs en marche et abonnés ; un message déjà
  dans une file de lettres mortes ou sur un *topic* y reste jusqu'à la fin de sa rétention. Les clés de l'event store rendent illisibles les événements d'une sauvegarde
  une fois détruites, raison pour laquelle elles vivent à part, avec une rétention plus courte
  ([Event sourcing](event-sourcing.fr.md#données-personnelles--crypto-shredding)).
- **Les journaux et les exports déjà remis.** Rien du kit ne les réécrit ; les adaptateurs de journal
  masquent les secrets, pas les noms ([Observabilité](observability.fr.md#ce-que-chaque-signal-peut-porter)).
- **Une colonne qu'aucune déclaration ne nomme.** Une règle lit le nom d'une colonne, pas ce qu'un
  champ texte peut contenir : une colonne `notes` peut tenir un diagnostic. Les déclarations sont
  l'inventaire qu'un projet maintient ; les règles `privacy/*` qui signalent une colonne non déclarée
  du vocabulaire usuel viennent avec une partie ultérieure de [la proposition](../proposals/privacy-by-design.fr.md).
- **Un *read model*.** Une projection garde ses lignes dans un *read model store*, pas dans une table
  à elle : elle ne déclare rien encore. La reconstruction d'une projection alimentée par l'event store
  retire la copie en clair qu'elle gardait, une fois donnée à `rebuilds`.
- **Les colonnes que l'agrégat n'écrit pas encore.** Le *mapper* écrit les colonnes déclarées vides
  tant que l'agrégat ne les porte pas ; l'effacement d'une colonne vide atteint la ligne malgré tout.

## Ce que l'outil ne décide pas

Le kit fournit les mesures techniques de la protection des données dès la conception (RGPD,
article 25) : déclaration, effacement, export, une preuve datée, et un registre et une rétention à
venir. La base légale de chaque traitement, l'information des personnes concernées, les sous-traitants
et l'analyse d'impact appartiennent au projet ; qu'une ligne pseudonymisée vaille effacement aux yeux
de la loi est au responsable de traitement d'en décider, comme la page du journal d'audit le dit de
ce qui reste dans la chaîne. Le document d'un export porte les données ; les informations qui
accompagnent la réponse à une demande d'accès (les finalités, les destinataires, la durée de
conservation, les droits de la personne, article 15(1)) sont la lettre que le projet écrit autour.
Par construction veut dire intégré par défaut, jamais une garantie juridique.

## Voir aussi

- [Event sourcing, par agrégat](event-sourcing.fr.md) : le scellement des événements stockés et les
  clés
- [Journal d'audit](audit-trail.fr.md) : la preuve datée d'un effacement et d'un export, les masques à
  clé par personne concernée
- [Multi-tenant](multitenancy.fr.md) : ce qu'un *tenant* confine, et pourquoi un effacement est joué
  une fois par *tenant*
- [Stockage de fichiers](file-storage.fr.md) : les fichiers d'une personne, déclarés comme `files`
  d'une déclaration
- [Protection des données dès la conception, au-delà de l'event sourcing](../proposals/privacy-by-design.fr.md) :
  les parties construites et celles à venir, les mots à employer
- La référence du CLI : [`init`](../../packages/cli/README.fr.md) (`--privacy`, `--event-sourcing`)
  et [`generate repository`](../../packages/cli/README.fr.md) (`--personal`, `--subject`,
  `--erasure`)
