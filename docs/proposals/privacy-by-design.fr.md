[English](privacy-by-design.md) · **Français**
<!-- translation-of: privacy-by-design.md sha256:535878e3903a485b -->

# Proposition : la protection des données dès la conception, au-delà de l'*event sourcing*

**Résumé.** Le kit efface une personne par *crypto-shredding* : une valeur personnelle d'un
événement stocké est scellée avec la clé de la personne concernée, et détruire la clé l'efface
partout où l'événement a été copié, sauvegardes comprises, avec une entrée datée dans le
journal d'audit. Cela vaut pour les agrégats gardés sous forme d'événements, et nulle part
ailleurs. Un projet qu'`init` écrit par défaut garde ses agrégats en lignes (Drizzle, Knex,
Prisma ou TypeORM), ses modèles de lecture en tables, et des copies d'une personne dans les
contextes qui ont consommé ses événements : rien du kit n'efface, n'exporte, ne limite dans le
temps ni n'inventorie quoi que ce soit de cela, et aucune règle ne le dit. Cette page vérifie
ce que le kit fait aujourd'hui, article par article du RGPD, conçoit les pièces manquantes dans
la forme du kit (une déclaration, des ports avec un adaptateur par ORM, des générateurs, des
identifiants de règle, rien d'obligatoire pour un projet sans données personnelles), découpe le
travail en *pull requests* dans l'ordre de fusion, et dit ce qu'un outil ne peut jamais
garantir, pour que « par construction » se lise « intégré par défaut » et jamais comme une
garantie légale.

## État (2026-10-24)

Les parties 0, 0b, 1, 2, 3, 4 et 5 sont construites. Les parties, dans l'ordre de fusion ; chacune est une
*pull request* à part, avec ses tests, sa documentation dans les deux langues, ses *skills* et
son fichier de `changes/`.

| Partie | Verdict |
|---|---|
| 0. Cette proposition | **écrite** |
| 0b. L'exemple efface une personne de bout en bout, à la main | **construite** (#267) : la personne d'identity, le contact de notification, les notes, les motifs d'annulation, les documents et le nom copié dans scheduling, réseau par réseau ; le README de l'exemple dit ce qui reste hors d'atteinte |
| 1. `personalFields` et les ports `PersonalDataErasure` et `PersonalDataExport` du kernel | **construite** (#268) : la déclaration, les deux ports, `eraseDataSubject` et `inEachTenant` dans le kernel, `InMemoryPersonalData`, les deux suites de contrat du package de tests ; avec la partie 5, `exportDataSubject` et le `PersonalDataExportDocument` qu'il répond, `recordsInEachTenant` |
| 2. `subjectMasker` du journal d'audit, une clé par personne concernée | **construite** (#270) : `subjectMasker(keys)` sur le `SubjectKeyStore`, `masked(field, { subject })`, le refus au câblage d'un champ masqué sans sujet et, avant toute clé, d'un sujet qui n'est pas un identifiant opaque |
| 3. L'adaptateur d'effacement sur les quatre ORM, modèles de lecture compris | **construite** (#271) : `KnexPersonalDataErasure`, `DrizzlePersonalDataErasure`, `PrismaPersonalDataErasure`, `TypeOrmPersonalDataErasure`, chacun sous la suite de contrat, le *tenant* confiné, les fichiers supprimés d'abord ; un modèle de lecture est une table comme une autre. Avec la partie 5, l'adaptateur d'export à côté de chacun : `KnexPersonalDataExport`, `DrizzlePersonalDataExport`, `PrismaPersonalDataExport`, `TypeOrmPersonalDataExport`, sous `personalDataExportContract`, et `auditedPersonalDataExport` dans le package d'audit |
| 4. `init` écrit `src/platform/privacy/` et câble l'*event sourcing* | **construite** (#274, puis les deux choix) : `--privacy on`, le défaut avec un ORM, écrit `src/platform/privacy/` (les listes des copies et des exports, `run-erasure.ts` et `run-export.ts`) et les scripts `privacy:erase` et `privacy:export` ; `--event-sourcing on`, off sauf demande, câble `Persistence.eventSourcing` sur les quatre ORM et en mémoire, et `src/platform/event-sourcing/` (les clés auditées, le chiffre, le module ou `platform.eventSourcing`) ; un projet sans donnée personnelle ne paie rien, un projet dont les agrégats sont des lignes ne paie aucune table ; pas encore de commande HTTP |
| 5. `generate repository` et `generate projection` déclarent les champs personnels | **construite** pour les *repositories* : `generate repository <ctx> <Aggregate> --personal <colonne>,... [--subject <colonne>] [--erasure pseudonymise\|row]` ajoute les colonnes au stockage, écrit la déclaration à côté du *mapper* sur les quatre ORM et, une fois par contexte, l'effacement et l'export qui la lisent (deux ports, adaptateurs sur `<Orm>PersonalDataErasure` et `<Orm>PersonalDataExport`, *fakes*, une *spec* sur la base de test, listés dans les copies et les exports de la plateforme ; `privacy:export` répond un document daté par `exportDataSubject`, chaque export audité quand le journal est actif). Une projection garde ses lignes dans un *read model store*, pas dans une table à elle : la déclaration d'un *read model* attend le registre (partie 9), qui lira ce que le *store* garde |
| 6. L'événement d'effacement, son gestionnaire généré, `personal` sur un événement d'intégration | proposée |
| 7. La conservation sur la déclaration, le *job* de purge généré | proposée |
| 8. `archiveBefore` sur le journal d'audit | proposée |
| 9. Le registre généré des données personnelles | proposée |
| 10. Les règles `privacy/*`, en avertissement d'abord | proposée |
| 11. L'exemple adopte les ports du kit | proposée |
| 12. La page de concept, les pages qu'elle touche, la formulation publique | **commencée** avec la partie 5 : [la page de concept](../concepts/personal-data.fr.md) dit ce qu'un projet généré contient, l'effacement de bout en bout, ce qui reste hors de portée et ce que l'outil ne décide pas ; le README et les autres pages viennent avec cette partie |

## Ce que le kit fait aujourd'hui

Vérifié sur les sources de 0.88.0 et les pages qui les décrivent.

**L'effacement des événements stockés.** `personalData(subjectId, value)` marque une valeur
dans l'`encode` d'un `defineStoredEvent` ; `PersonalDataCipher` la scelle avec la clé de sa
personne concernée (AES-256-GCM, un nonce par valeur) avant que le *store* la garde ;
`SubjectKeyStore` tient une clé par personne, en mémoire ou dans une table de l'*event store*,
et `erase(subject)` la détruit, de sorte qu'un rejeu lit `[erased]`. Les quatre *packages* de
persistance donnent cette table et ce *store* (`create<Orm>EventSourcing`). `auditedSubjectKeys`
de `@ddd-ts-kit/audit` écrit chaque effacement dans le journal, avec son acteur et sa date
([Event sourcing](../concepts/event-sourcing.fr.md#données-personnelles--crypto-shredding),
[Journal d'audit](../concepts/audit-trail.fr.md#le-droit-à-leffacement-et-une-chaîne-en-ajout-seul)).

**Le journal d'audit.** Une entrée porte des identifiants et des codes, jamais de contenu ; un
champ déclaré est masqué par `hmacMasker(secret)`, un seul secret pour tout le journal. La page
dit comment une clé par personne concernée rendrait vides de sens les masques d'une personne
effacée, et que le kit ne fournit pas un tel masqueur.

**Autour.** Les *spans* ne portent rien de personnel et les adaptateurs de *logs* masquent les
identifiants de connexion ([Observabilité](../concepts/observability.fr.md#ce-que-chaque-signal-peut-porter)) ;
une clé de fichier commence par `tenants/<tenant>/` et une requête qui signe un lien vers un
fichier contenant des données personnelles déclare sa permission sensible
([Stockage de fichiers](../concepts/file-storage.fr.md#sécurité)) ; le *skill* des événements
d'intégration demande des identifiants et des faits, pas de données personnelles, dans une
charge.

**L'exemple.** `examples/scheduling` efface un patient avec
`npm run erase:patient -- <patientId> <operatorId>` : la clé, l'entrée d'audit, puis la
reconstruction des projections alimentées par le *store*, pour que l'historique lise
`[erased]`.

Trois faits que les pages ne disaient pas, et dont cette proposition part :

1. **`init` ne câble aucun *event sourcing*.** Les *templates* de la plateforme montent
   l'outbox, les événements traités, les *jobs* et les processus ; ni `create<Orm>EventSourcing`,
   ni le `SubjectKeyStore`, ni le `PersonalDataCipher`. `generate aggregate --event-sourced`
   écrit l'agrégat, le codec de ses événements stockés (dont le `TODO(domain)` nomme
   `personalData`), son *builder* et sa *spec*, et aucun adaptateur de *repository* ni
   sérialiseur : l'exemple a câblé tout cela à la main dans `src/platform/`.
2. **L'exemple garde une personne en clair.** Le contexte `identity` stocke `display_name` et
   `email` dans sa table `persons`, `identity.person.registered` publie les deux, et le contexte
   `notification` copie l'adresse dans son modèle de lecture `contacts`. `erase:patient` ne
   touche aucun des trois : après un effacement, le patient est toujours nommé et joignable dans
   la base.
3. **Son README dit la limite en une demi-phrase.** « Limits of the erasure » parle du jour où
   `identity` effacera les personnes, et nulle part de ce qui reste dans ces deux tables et dans
   l'événement.

## Les exigences, ligne par ligne

Ce que le RGPD demande à un système, ce que le kit fait, ce qui manque. Effort : S est une
*pull request* d'une demi-journée, M une d'une journée, L deux ou trois. Risque : ce qui peut
rendre rouge un projet vert ou tromper un lecteur.

| Article | Le kit aujourd'hui | Ce qui manque | Effort | Risque |
|---|---|---|---|---|
| 25, protection des données dès la conception ; 5(1)(c), minimisation | le journal sans contenu, des *spans* propres, des clés de fichiers faites côté serveur, des charges d'identifiants | une déclaration des champs personnels, lue par chaque outil ; une règle qui signale un champ non déclaré | M | faible : une déclaration absente ne change rien |
| 17, effacement, des événements stockés | le scellement, `erase`, l'entrée d'audit | le câblage par `init` et par le générateur | M | faible |
| 17, effacement, des lignes | rien | les agrégats gardés en lignes sur les quatre ORM, les modèles de lecture, les fichiers d'une personne, un script ou un cas d'usage généré | L | moyen : les *templates* de *repository* de quatre ORM et le test de bout en bout de la CLI |
| 17, effacement, dans le journal | `masked()` sous un seul secret, une page qui dit comment faire mieux | un masqueur dont la clé dépend de la personne concernée ; le sujet d'un champ masqué, que `MaskingSubject` ne porte pas | S | faible |
| 17 et 19, propagation aux copies | l'outbox, des consommateurs idempotents, les files de rejet | un événement d'effacement du kit et son gestionnaire généré ; les copies dans les modèles de lecture des autres contextes ; les charges personnelles gardées par l'outbox, les files de rejet et les *topics* | L | moyen : un contrat publié par le kit, versionné comme les autres |
| 15, accès ; 20, portabilité | rien | un port d'export par contexte, un cas d'usage de la plateforme qui rassemble par personne, un format lisible | M | faible |
| 5(1)(e), limitation de la conservation | `purgePublished` de l'outbox, la purge horaire des fichiers en attente, les *jobs* planifiés par *tenant* | une conservation déclarée par table ou modèle de lecture, un *job* généré qui l'applique, l'archivage du journal | M | moyen : une purge détruit ; elle doit être explicite et testée |
| 30, registre des traitements | `describe`, `docs`, le catalogue d'événements, AsyncAPI | une section « Personal data » de chaque `CONTEXT.md` et un registre par personne, tous deux générés | S | faible : généré, jamais écrit à la main |
| 32, sécurité | des clés par personne, gardées à part ; des permissions sensibles sur les fichiers ; le périmètre par *tenant* et la sécurité au niveau des lignes | rien que l'outil doive ajouter ; les pages disent déjà de garder les clés à part | aucun | aucun |
| 6, base légale ; 12 à 14, information ; 28, sous-traitants ; 35, analyse d'impact | rien, à juste titre | rien qu'un outil puisse construire ; la formulation publique doit le dire | aucun | **élevé quand la formulation laisse croire le contraire** |

## La conception : une déclaration, lue par tout le reste

Aujourd'hui `personalData(subject, value)` est à la fois la déclaration et le mécanisme, pour
un seul support. La proposition garde le mécanisme par support et généralise la déclaration.
Les noms ci-dessous sont une proposition ; les *pull requests* les fixent.

### La déclaration

Un objet de l'infrastructure, à côté du *mapper*, qui dit quelles colonnes d'une ligne sont
personnelles et à qui elles appartiennent :

```ts
// infrastructure/persistence/person.personal-fields.ts
export const personPersonalFields = personalFields(persons, {
  subject: (row) => row.id,
  fields: ['display_name', 'email'],
  erasure: 'row', // ou 'pseudonymise' : la ligne reste, les champs lisent [erased]
});
```

- Dans le kernel : `PersonalFields<Row>`, la fonction `personalFields`, et deux ports
  optionnels, `PersonalDataErasure` (`erase(subject)`) et `PersonalDataExport`
  (`exportOf(subject)`). Un contexte sans données personnelles ne déclare rien et ne câble rien.
- Les quatre *packages* de persistance donnent le même adaptateur, prouvé par une suite de
  contrat de `@ddd-ts-kit/testing`, comme le sont les *fakes* des *brokers* et des
  *repositories*.
- La même déclaration pour un modèle de lecture : `ReadModelStore` supprime déjà une ligne par
  clé avec son tampon ; ce qui lui manque, c'est « les clés d'une personne », que la déclaration
  donne. La même pour les fichiers d'une personne : une zone par personne concernée, puisque
  `FileKeys.next(area)` en prend déjà une.
- Pour un événement d'intégration : `defineIntegrationEvent({ ..., personal: ['email'] })`. Il
  n'efface rien, puisqu'un message publié est publié ; il nourrit le catalogue, le registre et la
  règle qui signale un champ personnel publié en clair sans le dire.
- `personalData()` des événements stockés reste tel quel : il devient une des formes de la même
  déclaration, et le registre le lit aussi.

### Le mécanisme : `eraseDataSubject` dans le kernel, câblé par `init`

Le `eraseDataSubject` de l'exemple (`src/platform/erasure/`) monte dans le kernel : les clés
détruites d'abord, puis chaque `PersonalDataErasure` déclaré, puis la reconstruction des
projections alimentées par le *store*, puis l'entrée d'audit, avec les mêmes refus (un
identifiant qui n'est pas opaque, un identifiant que personne ne connaît). `init` écrit
`src/platform/privacy/` : le magasin de clés enveloppé par `auditedSubjectKeys`, le chiffreur,
les *stores* de l'*event sourcing* quand un agrégat l'est, un script
`npm run privacy:erase -- <subjectId> <operatorId>`, et une commande `EraseDataSubject` avec sa
permission `privacy.erase`, déclarée sensible, pour les projets qui l'exposent en HTTP. Le même
dossier porte `npm run privacy:export`.

### La propagation : un contrat publié par le kit

Un événement d'intégration `privacy.data-subject.erased` (version 1 : `subjectId`, `erasedAt`,
`requestedBy`), publié par le cas d'usage de la plateforme à travers l'outbox, et
`generate integration-handler <context> --erasure`, qui écrit le gestionnaire idempotent
appelant le `PersonalDataErasure` du contexte. La charge porte le seul identifiant : un
consommateur qui a copié l'e-mail dans son modèle de lecture le retire de son côté. Pour les
copies déjà parties (files de rejet, *topics*), la page dit la vérité : la rétention du *broker*
est la borne, comme la rétention des sauvegardes l'est aujourd'hui pour les clés.

### Le journal : `subjectMasker(keys)`

Un `AuditMasker` de `@ddd-ts-kit/audit` qui dérive sa clé HMAC de la clé de la personne dans le
`SubjectKeyStore` (HKDF du matériau, étiqueté pour le journal), avec
`masked('patientEmail', { subject: (command) => command.patientId })`, puisque le sujet d'un
champ masqué n'est ni l'acteur ni la ressource de l'entrée. Effacer la personne rend ses masques
impossibles à recalculer ; la chaîne reste valide. `hmacMasker` reste pour qui veut un seul
secret.

### La conservation : sur la même déclaration

`personalFields(..., { retention: { after: 'ends_at', months: 36 } })`, et un équivalent pour
une table sans champ personnel mais à durée de vie bornée. Un *job* généré
`<context>.purge-expired` (`generate job --purge`), idempotent, appelle `purgeExpired(now)` de
l'adaptateur, par *tenant* quand il y a des *tenants*. Pour le journal, `archiveBefore(date)`
exporte les entrées d'une chaîne vers le stockage de fichiers avec le hash de sa tête, puis les
retire ; la chaîne repart d'un point d'ancrage daté, ce que la page sur l'ancrage décrit déjà en
principe.

### Le registre : généré

`ddd-ts-kit docs` ajoute une section `## Personal data` à chaque `CONTEXT.md` (champ, personne,
support, effacement, conservation, où il part) et écrit `docs/privacy/register.md`, la vue par
personne : quels contextes connaissent une personne, par quels champs, qui les reçoit, pendant
combien de temps. `docs --check` échoue sur une dérive, comme pour le reste. Ce n'est pas le
registre de l'article 30, qui demande la finalité, la base légale et les destinataires hors du
système : la page le dit et laisse ces colonnes au responsable du traitement.

### Les règles, chacune avec un identifiant

| Identifiant | Ce qu'elle signale | Où |
|---|---|---|
| `privacy/declared-field` | une colonne de table ou un champ de modèle de lecture dont le nom appartient au vocabulaire personnel (`email`, `phone`, `birth_date`, `first_name`, `iban`... une liste du kit plus `privacy.vocabulary` de la configuration) sans déclaration `personalFields` | `ddd-ts-kit check` (texte) |
| `privacy/event-payload-declared` | un champ de ce vocabulaire dans la charge d'un événement d'intégration sans `personal: [...]` | check et ESLint |
| `privacy/erasure-reaches-copies` | un contexte qui consomme un événement déclarant des champs personnels et n'a ni `PersonalDataErasure` ni gestionnaire d'effacement | check (projet) |
| `privacy/subject-is-opaque` | un `personalFields` ou un `personalData` dont le sujet est lui-même un champ personnel (un e-mail comme identifiant) | check et ESLint |
| `privacy/no-personal-data-in-logs` | un appel au *logger* ou aux métriques dont l'argument nomme un champ personnel déclaré | ESLint (une approximation) |

Toutes à `warn` par défaut, en erreur une version mineure plus tard, comme
[CONTRIBUTING.md](../../CONTRIBUTING.fr.md) le demande. Toutes muettes dans un projet sans
déclaration et sans mot du vocabulaire : rien n'est obligatoire pour un projet sans données
personnelles.

## Les *pull requests*, dans l'ordre de fusion

Chacune avec ses tests, ses pages anglaise et française, ses *skills*, son fichier `changes/`,
`claude plugin validate` quand le *plugin* bouge, `docs/ARCHITECTURE.md` quand une règle ou un
dossier de l'arbre canonique bouge. Indépendantes sauf là où c'est dit.

| # | *Pull request* | Contenu | Après | Taille |
|---|---|---|---|---|
| 0 | `docs(proposals): privacy by design` | cette page et sa page française, le lien dans l'index, les termes du glossaire | rien | S |
| 0b | `feat(example): scheduling erases a person end to end` | sans attendre le kit : un pas d'effacement par contexte dans l'exemple (`identity` pseudonymise la ligne `persons`, `notification` supprime la ligne `contacts`), appelés par `eraseDataSubject` après la clé et avant les reconstructions ; une *spec* d'intégration qui lit la base après `erase:patient` ; le README dit en clair ce qui reste (l'événement publié, les sauvegardes). Ce code écrit à la main est la spécification du port de la partie 1 | 0 | M |
| 1 | `feat(kernel): personalFields and the PersonalDataErasure port` | `PersonalFields`, `personalFields()`, les ports `PersonalDataErasure` et `PersonalDataExport`, `eraseDataSubject` remonté de l'exemple, des *fakes* en mémoire, la suite de contrat dans `@ddd-ts-kit/testing` | rien | M |
| 2 | `feat(audit): subjectMasker on the SubjectKeyStore` | `subjectMasker(keys)`, `masked(field, { subject })`, `MaskingSubject.dataSubject`, les pages de l'audit, le *skill* cross-cutting | rien | S |
| 3 | `feat(orm): the erasure adapter on the four ORMs` | `DrizzlePersonalDataErasure`, Knex, Prisma, TypeORM, `erasure: 'row' \| 'pseudonymise'`, modèles de lecture compris, chacun sous la suite de contrat, le *tenant* respecté | 1 | M, ou une *pull request* par ORM |
| 4 | `feat(cli): init writes the privacy platform folder` | `src/platform/privacy/` : les clés auditées, le chiffreur, `privacy:erase`, `privacy:export`, les *stores* de l'*event sourcing* quand un agrégat l'est, la commande `EraseDataSubject` optionnelle ; `init --force` pour un projet existant ; la section 2 de la référence d'architecture | 1, 2 | M |
| 5 | `feat(cli): generate repository declares the personal fields` | `generate repository ... --personal <field>,<field> --subject <column>` écrit la déclaration à côté du *mapper* sur les quatre ORM ; `generate projection` de même pour un modèle de lecture ; le test de bout en bout génère puis vérifie | 1, 3 | M |
| 6 | `feat(events): the erasure event and its generated handler` | `dataSubjectErasedV1` dans `@ddd-ts-kit/events`, publié par le cas d'usage de la plateforme ; `generate integration-handler --erasure` ; `personal: [...]` sur `defineIntegrationEvent`, lu par le catalogue et AsyncAPI (`x-personal-data`) | 1, 4 | M |
| 7 | `feat(kernel): retention on the declaration and the purge job` | `retention` sur `personalFields` et `retainedRows` pour une table sans champ personnel, `purgeExpired` sur les adaptateurs, `generate job --purge`, par *tenant* | 3 | M |
| 8 | `feat(audit): archiveBefore on the trail` | l'archivage d'une chaîne vers `FileStorage` avec le hash de sa tête, l'ancrage, la page de ses limites | rien | M |
| 9 | `feat(cli): the personal data register` | la section `## Personal data` du `CONTEXT.md`, `docs/privacy/register.md`, `describe --json`, `docs --check` | 1, 6 | S |
| 10 | `feat(check): the privacy rules` | les cinq règles à `warn` avec leur transition, les *fixtures*, `explain`, les sections 3 et 4 de la référence d'architecture, les *skills* (persistence, integration-event, cross-cutting) ; ESLint pour les deux qui lisent du code, dans une seconde *pull request* | 1, 6 | L |
| 11 | `refactor(example): scheduling adopts the privacy ports of the kit` | les pas d'effacement de la partie 0b remplacés par `personalFields` et `PersonalDataErasure`, `erase:patient` par `privacy:erase`, le gestionnaire de `privacy.data-subject.erased` dans `notification` ; la *spec* de la partie 0b reste et prouve l'équivalence | 3, 4, 6 | S |
| 12 | `docs: the privacy pages and the public wording` | `docs/concepts/personal-data.md` (une nouvelle page de concept, sur le chemin de lecture avant la production), les pages *event sourcing*, journal d'audit, stockage de fichiers et multitenance, le README (une ligne de fonctionnalité et un encadré sur ce que l'outil ne décide pas), les *skills* | tout | M |

Ordre de fusion : 0, 0b, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12. Les parties 2 et 8 peuvent
commencer à côté de 1 et 3. La partie 0b rend l'effacement vrai dans l'exemple à la deuxième
fusion plutôt qu'à la douzième, au prix d'un code écrit deux fois, à la main puis à travers les
ports : c'est ainsi que le kit a grandi jusqu'ici, et `eraseDataSubject` lui-même vit dans
l'exemple avant de monter dans le kernel. Une version mineure après la partie 6 (les ports et le
dossier de la plateforme), une autre après la partie 10 (les règles en avertissement), et
l'erreur sur les règles une version mineure plus tard.

## Ce qui n'est pas proposé

- **Un contexte `privacy`.** [Quels contextes méritent un *preset*](context-presets.fr.md#demandes-sur-les-données-personnelles--un-guide)
  l'a tranché : les demandes sur les données personnelles traversent chaque contexte, et un
  contexte qui y répondrait seul devrait lire les tables de tout le monde. Une capacité de la
  plateforme, comme le journal d'audit et les fichiers.
- **Un chiffrement par personne des colonnes gardées en lignes.** Le *crypto-shredding* d'une
  table casse ses index, ses recherches et ses contraintes d'unicité ; supprimer ou
  pseudonymiser la ligne est la pratique courante, et les sauvegardes restent la borne, comme
  elles le sont aujourd'hui pour les clés.
- **Le consentement, une bannière, une notice.** Hors de portée d'un kit de *back-end*.

## Ce qu'un outil ne peut pas garantir, et les mots à employer

Un kit peut garantir des mécanismes et leur présence : chaque champ personnel déclaré est
effaçable, exportable, daté et inventorié ; un champ non déclaré du vocabulaire connu est
signalé ; un effacement laisse une preuve. Il ne peut pas garantir :

- la **base légale** de chaque traitement (article 6), ni sa **finalité** ;
- l'**information des personnes concernées** (articles 12 à 14), le **consentement** et son
  retrait ;
- les **sous-traitants** et les **transferts** (articles 28 et 44 et suivants) : l'hébergeur,
  un *broker* géré, un service d'e-mail ;
- l'**analyse d'impact** (article 35), le délégué à la protection des données, la
  **notification d'une violation** (article 33) ;
- qu'une déclaration soit **complète** : une règle lit le nom d'une colonne, pas ce qu'un champ
  de texte peut contenir ; une colonne `notes` peut porter un diagnostic ;
- les **sauvegardes** et la **rétention du *broker*** : la borne d'un effacement est une date,
  jamais un instant ;
- la **valeur juridique** d'une pseudonymisation plutôt que d'une suppression, que le
  responsable du traitement décide, comme la page du journal d'audit le dit déjà de ce qui reste
  dans la chaîne.

La formulation qui en découle, pour le README et pour ce qui présente le kit :

- Dire « **les mécanismes de la conformité, par construction** » ou « **la protection des
  données dès la conception, outillée** », jamais « la conformité par construction » seule, qui
  se lit comme une garantie légale.
- Sur le droit à l'effacement : « **Effaçable par construction.** Chaque champ personnel est
  déclaré ; une commande efface une personne des tables, des événements et des copies des autres
  contextes, et laisse une preuve datée. » Tant que les parties 0b à 11 ne sont pas fusionnées,
  ajouter « pour les agrégats gardés sous forme d'événements, et dans l'exemple ».
- Un encadré sous les fonctionnalités du README : « **Ce que le kit ne décide pas.** Le kit
  fournit les mesures techniques de la protection des données dès la conception (RGPD, article
  25) : déclaration, effacement, export, conservation, un registre et une preuve datée. La base
  légale de chaque traitement, l'information des personnes concernées, les sous-traitants et
  l'analyse d'impact appartiennent au projet ; une règle lit un nom de colonne, pas ce qu'un
  champ de texte peut contenir. Par construction veut dire intégré par défaut, jamais une
  garantie légale. »

## Non décidé

- Si `erasure: 'pseudonymise'` devrait être le défaut d'une déclaration générée plutôt que
  `'row'` : une ligne supprimée casse les clés étrangères de ce qui référençait la personne, une
  ligne pseudonymisée garde l'historique lisible sans la personne. Le premier adaptateur le dira.
- Si l'export d'une personne devrait être un cas d'usage de la plateforme qui appelle chaque
  `PersonalDataExport`, ou un événement d'intégration `privacy.data-subject.export-requested`
  auquel chaque contexte répond par un fichier, comme le fait l'effacement. Tranché pour le
  monolithe avec la partie 5 : la première forme, `exportDataSubject` lancé par `privacy:export`,
  chaque export audité ; la seconde reste pour un contexte extrait en service à part.
- Si le vocabulaire de `privacy/declared-field` devrait être une liste du kit, ou une liste que
  le projet écrit en entier : une liste du kit signale `email` dans un projet qui n'y a jamais
  pensé, ce qui est le but, et le signale aussi dans une colonne qui tient une adresse système,
  ce qui est une dérogation à enregistrer.

## Sources

- Règlement (UE) 2016/679 (RGPD), articles 5, 6, 12 à 14, 15, 17, 19, 20, 25, 28, 30, 32, 33
  et 35 : <https://eur-lex.europa.eu/eli/reg/2016/679/oj>.
- Mathias Verraes et d'autres sur les charges oubliables et le *crypto-shredding* dans les
  *event stores*, tels que les cite [Event sourcing](../concepts/event-sourcing.fr.md#sources).

## Voir aussi

- [Event sourcing, par agrégat](../concepts/event-sourcing.fr.md) : ce que le scellement fait aujourd'hui
- [Journal d'audit](../concepts/audit-trail.fr.md) : la chaîne, les masques et la preuve d'un effacement
- [Stockage de fichiers](../concepts/file-storage.fr.md), [Multitenance](../concepts/multitenancy.fr.md)
- [Quels contextes méritent un *preset*](context-presets.fr.md) : pourquoi aucun contexte `privacy`
