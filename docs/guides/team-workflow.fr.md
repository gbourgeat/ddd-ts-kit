[English](team-workflow.md) · **Français**
<!-- translation-of: team-workflow.md sha256:3461bbf3f711c226 -->

# Travailler en équipe sur un projet DDD

**Résumé.** Un contexte délimité (bounded context) est une unité de propriété autant qu'une unité
de code. Ce guide décrit comment une équipe s'organise autour de cela : un propriétaire par
contexte, le glossaire comme un bien partagé avec un éditeur désigné, des contrats convenus avant
que les deux côtés ne construisent, une carte des contextes qui dit qui peut toucher à quoi, une
revue qui regarde autre chose dans chaque couche, de petites *pull requests*, un ordre fixe pour
les changements qui traversent deux contextes, des enregistrements de décision, et des
vérifications automatiques qui retirent des mains des personnes les commentaires de revue
récurrents. Il se termine par un plan d'accueil en une journée.

## Un propriétaire par contexte délimité

Chaque contexte a une équipe ou une personne propriétaire. Être propriétaire, c'est décider de
son modèle, éditer son glossaire, approuver les changements de son `published-language/`, et
répondre de ses tests. Cela ne veut pas dire que personne d'autre ne peut y ouvrir une *pull
request* ; cela veut dire que personne n'en fusionne une sans le propriétaire.

| Élément | Propriétaire | Les autres peuvent |
|---|---|---|
| `src/contexts/<context>/domain`, `application`, `infrastructure`, `presentation` | le propriétaire du contexte | proposer un changement, relu par le propriétaire |
| `src/contexts/<context>/published-language/` | le propriétaire du contexte, ses consommateurs consultés | l'importer, si la relation est déclarée |
| `src/contexts/<context>/CONTEXT.md` | le propriétaire du contexte | proposer un terme |
| `src/shared-kernel/` | chaque contexte qui l'utilise, conjointement | rien sans les copropriétaires |
| `src/platform/`, `src/main.ts`, `ddd-ts-kit.config.json`, les fichiers du *pipeline* | un propriétaire de la plateforme désigné (souvent le responsable technique) | proposer ; ces fichiers portent les règles |
| les sections rédigées de `docs/context-map.md`, `docs/adr/` | le responsable technique, avec les propriétaires concernés | proposer |

Sur GitHub ou GitLab, un fichier de propriétaires du code exprime ce tableau mécaniquement. Le
kit n'en génère pas : écrivez-le à la main à partir de la liste des contextes
(`npx ddd-ts-kit list`). Pour un projet avec un contexte `appointments` et un contexte
`analytics` :

```text
# .github/CODEOWNERS (GitHub) ou CODEOWNERS (GitLab) : la dernière ligne qui correspond l'emporte
src/contexts/appointments/      @clinic/appointments-team
src/contexts/analytics/         @clinic/data-team
src/shared-kernel/              @clinic/appointments-team @clinic/data-team
src/platform/                   @clinic/tech-lead
src/main.ts                     @clinic/tech-lead
ddd-ts-kit.config.json          @clinic/tech-lead
.github/workflows/              @clinic/tech-lead
docs/adr/                       @clinic/tech-lead
```

Avec une protection de branche qui exige la revue d'un propriétaire du code, un changement sous
`src/contexts/appointments/` ne peut pas être fusionné sans l'équipe appointments. Une ligne à
deux propriétaires demande l'un des deux, pas les deux : l'approbation conjointe du noyau partagé
est une règle que l'équipe tient, et que le fichier seul n'impose pas. Les consommateurs d'un
`published-language/` sont sollicités nommément sur ses *pull requests*, comme relecteurs.

Pourquoi un seul propriétaire : un modèle ne reste cohérent que si quelqu'un peut dire non. La
loi de Conway joue dans les deux sens (Skelton et Pais appellent son usage délibéré la manœuvre
de Conway inverse) : des frontières qui suivent celles des équipes tiennent, des frontières qui
coupent le travail quotidien d'une équipe s'érodent. Un contexte qu'une seule équipe ne peut pas
garder en tête est trop gros, voir
[Quand extraire des microservices](when-to-extract-microservices.fr.md) pour ce que la charge
cognitive justifie et ce qu'elle ne justifie pas.

## Le glossaire est un bien partagé

Le tableau `## Ubiquitous language` de chaque `CONTEXT.md` est la source de chaque nom de
classe, de méthode et d'événement du contexte, et le *checker* y tient le code
(`language/glossary-term`). Cela fait du glossaire le fichier le plus relu d'un contexte, alors
décidez qui l'édite :

- **Le propriétaire édite ; tout le monde propose.** Un nouveau terme arrive dans la même *pull
  request* que le premier nom qui l'utilise (`--term "<Term>=<meaning>"` sur le générateur), et
  le propriétaire relit le sens, pas l'orthographe.
- **Un expert du domaine valide le sens.** Un développeur peut écrire « Slot : un instant de
  début et un instant de fin auxquels un praticien peut recevoir » ; seule une personne du
  métier peut dire si un créneau inclut la marge entre deux rendez-vous.
- **Même mot, deux contextes : deux lignes.** `Appointment` dans `appointments` est un
  engagement soumis à des règles ; dans `analytics`, c'est un fait compté. Chaque glossaire dit
  avec quoi le mot ne doit pas être confondu chez le voisin. Ne les unifiez pas dans le noyau
  partagé pour économiser une ligne.
- **Un terme change de sens : traitez-le comme un changement cassant.** Renommez dans le code
  dans la même *pull request*, et regardez les événements publiés qui portent le mot.

`--allow-name` existe pour passer outre le générateur ; `check` signale toujours le nom. S'en
servir est le signe que la conversation sur le glossaire a été sautée.

## Les contrats d'abord

Deux équipes ne peuvent construire en parallèle que si ce qui circule entre elles est convenu
avant que l'une ou l'autre ne commence. Il y a trois sortes de contrats dans ce kit, et tous sont
des fichiers qui peuvent être relus pour eux-mêmes :

| Contrat | Fichier | Convenu entre |
|---|---|---|
| événement d'intégration | une déclaration `defineIntegrationEvent` dans le `published-language/` du producteur | le producteur et chaque consommateur |
| contrat de lecture pour un besoin synchrone | une classe abstraite dans le `published-language/` de l'amont (`*.contract.ts`, écrit par `generate gateway`), derrière un port *gateway* de l'appelant | l'amont et l'appelant |
| API HTTP | les définitions des routes, à partir desquelles `openapi/openapi.yaml` est généré | le *back-end* et ses clients |

La pratique :

1. Le consommateur dit ce dont il a besoin pour agir sans rappeler (« pour envoyer une
   confirmation, il me faut l'identifiant du rendez-vous, celui du client, celui du praticien et
   l'instant de début »).
2. Le propriétaire du producteur écrit la déclaration (type, version, schéma du contenu avec une
   description par champ) et ouvre une *pull request* qui ne contient que cela : l'événement, son
   *publisher* et le catalogue régénéré.
3. Les consommateurs relisent cette *pull request*. Une fois fusionnée, les deux côtés
   construisent : le producteur fait émettre le fait par l'agrégat, le consommateur écrit son
   gestionnaire (handler) contre le type déclaré, testé avec des événements construits à partir
   de la déclaration.

La déclaration au cœur de cette première *pull request* est courte, et chacune de ses lignes est
un point dont les consommateurs peuvent débattre :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

// src/contexts/appointments/published-language/appointment-booked.v1.integration-event.ts
export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  description: 'An appointment was booked: the practitioner expects the client at the start instant.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string().describe('Identifier of the appointment.'),
      clientId: z.string().describe('The client who comes.'),
      practitionerId: z.string().describe('The practitioner who receives the client.'),
      startsAt: z.string().describe('Start instant, ISO 8601 in UTC.'),
    }),
  ),
});

export type AppointmentBookedV1 = IntegrationEvent<PayloadOf<typeof appointmentBookedV1>>;

// Dans les specs du consommateur, le lendemain : un événement construit à partir de la déclaration,
// avant que le producteur n'émette quoi que ce soit. Un contenu qui viole le schéma lève une erreur ici, pas en production.
export const booked: AppointmentBookedV1 = appointmentBookedV1.create(
  { appointmentId: 'a-1', clientId: 'c-1', practitionerId: 'p-1', startsAt: '2026-10-20T09:00:00.000Z' },
  { id: 'evt-1', occurredAt: '2026-10-13T08:00:00.000Z' },
);
```

Il en va de même pour une route : fusionnez la définition de la route avec ses schémas et ses
erreurs déclarées, régénérez le document OpenAPI, et une équipe *front-end* peut générer son client
à partir du fichier commité pendant que le gestionnaire est encore un `TODO(domain)`.

Une *pull request* « contrat d'abord » est petite et peu coûteuse à discuter. La même discussion
menée une fois les deux côtés construits coûte une réécriture de l'un d'eux.

## La carte des contextes borne qui peut toucher à quoi

La carte n'est pas que de la documentation. Trois règles en font un système de permissions pour
les imports :

- un autre contexte n'est atteint que par son `published-language/`
  (`context/published-language-only`) ;
- et seulement si la relation est déclarée dans la configuration (`context/declared-relationship`) ;
- et les relations déclarées ne forment aucun cycle (`context/no-cycle`).

![Trois contextes et les imports que le checker accepte : analytics peut importer le langage publié d'appointments parce que la configuration déclare cette relation ; un import du domaine d'appointments est refusé par context/published-language-only, et un import depuis notifications, qu'analytics ne nomme pas parmi ses amonts, par context/declared-relationship](../assets/diagrams/team-workflow-imports.fr.svg)

La relation est une entrée de la configuration, dans la liste des amonts de l'aval :

```json
{
  "contexts": {
    "appointments": { "classification": "core", "upstreams": [] },
    "analytics": {
      "classification": "supporting",
      "upstreams": [{ "context": "appointments", "relationship": "conformist" }]
    }
  }
}
```

et l'import qui va avec nomme le langage publié, jamais ce qu'il y a derrière :

```ts
// Au lieu de : l'agrégat d'un autre contexte (context/published-language-only)
import { Appointment } from '@/contexts/appointments/domain/aggregates/appointment.aggregate';

// écrivez : ce qu'appointments publie pour ses consommateurs
import { appointmentCancelledV1 } from '@/contexts/appointments/published-language/index';
```

Ainsi, « mon contexte peut-il utiliser quelque chose du vôtre ? » a une réponse mécanique, et
ajouter une dépendance entre deux contextes est un changement visible de
`ddd-ts-kit.config.json`, relu par les deux propriétaires, et non un import égaré découvert six
mois plus tard. Le patron de relation dit comment les deux équipes travaillent ensemble : en
`customer-supplier`, les besoins de l'aval entrent dans la planification de l'amont ; en
`conformist`, l'aval accepte ce qui vient ; un `shared-kernel` exige l'approbation conjointe de
chaque changement. Voir [Carte des contextes](../concepts/context-map.fr.md).

## Ce que la revue regarde dans chaque couche

Les vérifications automatiques tiennent la structure, si bien qu'une revue humaine peut porter
son attention là où un outil ne peut pas juger. Ce qu'il faut regarder diffère selon la couche :

| Couche | Le relecteur se demande | Ne mérite pas de commentaire (une vérification le tient) |
|---|---|---|
| `domain/` | La règle est-elle dans l'agrégat, et est-ce la bonne règle ? Peut-on construire un état invalide ? Les noms disent-ils ce que dit le métier ? L'agrégat a-t-il la bonne taille ? | la visibilité du constructeur, les *setters*, les imports, `new Date()` |
| `application/` | Le gestionnaire ne fait-il qu'orchestrer (charger, une intention, enregistrer) ? La permission est-elle la bonne ? Chaque échec est-il une erreur du domaine nommée ? | la forme du gestionnaire, une déclaration de permission manquante, la lecture de la portée ambiante, une diffusion manuelle des événements du domaine (l'enregistrement les transmet, l'unité de travail les diffuse), un gestionnaire d'événement du domaine dont l'effet sort de la base de données laissé dans la phase `before-commit` |
| `infrastructure/` | Le *mapper* couvre-t-il chaque champ dans les deux sens ? La requête est-elle restreinte par *tenant* ? L'adaptateur passe-t-il la même suite de contrat que son *fake* ? Que se passe-t-il quand la dépendance est en panne ? | l'import de `presentation/`, un adaptateur construit hors de la racine de composition |
| `presentation/` | La réponse est-elle un DTO et non l'agrégat ? Tous les codes d'erreur sont-ils déclarés sur la route ? Le changement casse-t-il les clients ? | une `security` manquante, un test de rôle dans la route |
| `published-language/` | Un consommateur comprendrait-il ce contenu sans poser de question ? Quelque chose d'interne ou de personnel fuit-il ? Est-ce un ajout, ou une nouvelle version ? | un import hors de la liste autorisée |
| tests | Le nom se lit-il comme une règle métier ? Vérifie-t-il un résultat par l'API publique ? | les *mocks*, un fichier de *spec* manquant, un *builder* manquant |

Le *plugin* offre le même découpage sous forme d'outil : l'agent `architecture-reviewer` relit un
diff ou un contexte entier en lecture seule, en partant de la sortie du *checker* puis en jugeant
ce que les outils ne peuvent pas juger.

## Branches et petites pull requests

- *Trunk-based* : des branches de courte durée partant de la branche par défaut, fusionnées en un
  jour ou deux. Une branche de longue durée par contexte met en échec les fichiers générés
  (*barrels*, carte des contextes, OpenAPI), qui entrent d'autant plus en conflit qu'ils
  divergent longtemps.
- Un cas d'usage ou un concept par *pull request* ; les tailles et leurs raisons sont dans
  [La discipline des commits](commit-discipline.fr.md).
- Fusion par *squash*, avec un titre de *commit* conventionnel : le *pipeline* vérifie le titre de
  la *pull request* avec la même configuration commitlint que le *hook* de *commit*, parce qu'avec
  des fusions par *squash* le titre devient le *commit* sur la branche par défaut.
- Le *job* final `gate` est la seule vérification requise ; voir
  [pipeline/README.md](../../pipeline/README.md).

## Un changement qui traverse deux contextes

« Quand un rendez-vous est annulé tardivement, `analytics` doit le compter comme une annulation
tardive. » Cela touche `appointments` (le fait doit dire s'il était tardif) et `analytics` (le
comptage). Ce n'est jamais une seule *pull request*. Découpez-le le long du contrat et ordonnez-le
en commençant par l'amont :

![Un changement qui traverse deux contextes, en une proposition puis trois pull requests sur deux couloirs : le propriétaire d'appointments propose un changement additif du contenu et le propriétaire d'analytics l'accepte, puis appointments fusionne son langage publié, puis l'agrégat qui calcule le fait, pendant qu'analytics fusionne un gestionnaire qui tolère l'absence du champ ; chaque pull request est verte et déployable seule](../assets/diagrams/team-workflow-cross-context.fr.svg)

Les étapes 2 et 4 en code. Le champ est facultatif, il reste donc dans la version 1, et le
consommateur lit un événement qui ne l'a pas comme « inconnu », jamais comme « à temps » :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';

// Étape 2, appointments : published-language/appointment-cancelled.v1.integration-event.ts
export const appointmentCancelledV1 = defineIntegrationEvent({
  type: 'appointments.appointment.cancelled',
  version: 1,
  description: 'An appointment was cancelled before it took place; its slot is free again.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string().describe('Identifier of the appointment.'),
      cancelledAt: z.string().describe('When it was cancelled, ISO 8601 in UTC.'),
      late: z
        .boolean()
        .optional()
        .describe('True when cancelled less than 24 hours before the start; absent from the events published before.'),
    }),
  ),
});

export type AppointmentCancelledV1 = IntegrationEvent<PayloadOf<typeof appointmentCancelledV1>>;

// Étape 4, analytics : un port à lui, et un gestionnaire qui tolère les deux mondes
export abstract class CancellationCounts {
  abstract count(appointmentId: string, kind: 'late' | 'on-time' | 'unknown'): Promise<void>;
}

@IntegrationEventHandler(appointmentCancelledV1, { consumer: 'analytics.appointments-appointment-cancelled' })
export class AppointmentsAppointmentCancelledHandler {
  constructor(private readonly counts: CancellationCounts) {}

  async handle(event: AppointmentCancelledV1): Promise<void> {
    const { appointmentId, late } = event.payload;

    if (late === undefined) {
      // publié avant l'étape 3, ou par un producteur pas encore déployé
      await this.counts.count(appointmentId, 'unknown');
      return;
    }

    await this.counts.count(appointmentId, late ? 'late' : 'on-time');
  }
}
```

Les règles du découpage :

1. **L'amont d'abord.** L'aval ne peut pas importer un champ qui n'est pas publié.
2. **Additif chaque fois que possible.** Un nouveau champ facultatif reste dans la version ; le
   consommateur déployé avant l'étape 3 continue de fonctionner. Tout le reste est une nouvelle
   version publiée à côté de l'ancienne, voir
   [Le versionnement des événements](../concepts/event-versioning.fr.md).
3. **Le consommateur tolère les deux mondes** jusqu'à ce que le producteur soit déployé partout :
   les événements déjà dans l'outbox ou dans une file d'attente ont été produits par l'ancien
   code.
4. **Chaque *pull request* est déployable seule.** Si l'étape 4 ne peut pas partir avant
   l'étape 3, l'ordre est faux.

Un changement qui semble exiger que les deux contextes changent dans la même transaction n'est
pas un problème de découpage mais un problème de frontière : revenez au test de cohérence de
[Contexte délimité](../concepts/bounded-context.fr.md).

## Enregistrements de décision d'architecture

Un choix qui contraint l'avenir reçoit un enregistrement dans `docs/adr/` : une frontière, un
patron de relation autre que celui par défaut, un fournisseur, une exception à une règle.
`npx ddd-ts-kit generate adr "<title>"` écrit le fichier numéroté ; avec `--deviation <what>`, il
écrit aussi l'entrée `deviations` de la configuration qui pointe vers lui, que
`governance/recorded-deviation` exige pour toute règle assouplie :

```bash
npx ddd-ts-kit generate adr "No spec for generated adapters" \
  --deviation rules.test/spec-required --reason "Generated adapters are covered by the contract suite."
```

écrit `docs/adr/0009-no-spec-for-generated-adapters.md` (le prochain numéro libre) et ajoute à
`ddd-ts-kit.config.json` :

```json
"deviations": [
  { "what": "rules.test/spec-required", "adr": "0009", "reason": "Generated adapters are covered by the contract suite." }
]
```

Un projet dont les équipes travaillent en parallèle numérote ses enregistrements par bloc
(`0401`, `0402` pour une story, `0701` pour une autre), pour que deux branches ne prennent
jamais le même numéro : `--number 401` écrit `docs/adr/0401-<slug>.md`, son titre
`# ADR-0401` et l'`adr` de son entrée `deviations`, et refuse un numéro déjà présent dans
`docs/adr/`. Sans lui, l'enregistrement prend le numéro qui suit le plus grand.

La règle elle-même est assouplie dans la même *pull request*, dans les `rules` de la
configuration, là où les relecteurs voient l'exception et son enregistrement côte à côte.

Tenez-les à une demi-page : contexte, décision, conséquences, alternatives écartées. Un
enregistrement accepté n'est jamais réécrit ; un enregistrement ultérieur le remplace. C'est
l'enregistrement qui permet à un nouvel arrivant de distinguer une décision d'un accident.

## Les vérifications remplacent les commentaires de revue récurrents

Tout commentaire qu'un relecteur écrit pour la troisième fois devrait devenir une vérification,
et la plupart des commentaires habituels le sont déjà :

| Le commentaire qu'il n'est plus besoin d'écrire | Tenu par |
|---|---|
| « le domaine ne doit pas importer l'ORM » | `layer/domain-purity` |
| « n'allez pas dans les entrailles de l'autre contexte » | `context/published-language-only` |
| « que veut dire `Manager` ici ? » | `language/no-technical-name`, `language/glossary-term` |
| « injectez l'horloge » | `purity/no-system-clock` |
| « ce cas d'usage n'a pas de permission » | `authz/declared` |
| « où est le test ? » | `test/spec-required` |
| « ne faites pas de *mock* du *repository* » | `test/no-mocks` |
| « supprimez le code commenté » | `clean/no-commented-out-code` |
| « pourquoi cette règle est-elle désactivée ? » | `governance/recorded-deviation` |
| « vous avez oublié de régénérer le fichier OpenAPI » | la porte de dérive de la documentation |

Les identifiants des règles et leurs énoncés exacts sont dans la
[référence d'architecture](../ARCHITECTURE.fr.md#3-règles-de-dépendance). Un constat nomme sa
règle, et la règle s'explique elle-même, si bien que l'auteur apprend la raison sans attendre un
relecteur :

```text
$ npx ddd-ts-kit explain purity/no-system-clock
purity/no-system-clock

No new Date() without argument, Date.now() or performance.now() in domain/ or application/: time comes from the Clock port.

Why: Code that reads the clock gives a different answer every time it runs, so its tests are either flaky or need a mocked module. Passing the instant in, from the Clock port, makes every rule about time testable with a fixed date and replayable in production.

Bad:
    isOverdue(): boolean { return this.dueDate < new Date(); }

Good:
    isOverdue(now: Date): boolean { return this.dueDate < now; }

Suppress one line (with a reason): // ddd-ts-kit-disable-next-line purity/no-system-clock -- <reason>
```

Les vérifications tournent à trois moments : à chaque écriture de fichier dans une session
d'agent (le *hook* du *plugin*), sur les fichiers indexés (pre-commit), et en CI. Une revue qui
commence après une porte verte est une revue de conception.

![Où tournent les vérifications : à chaque écriture de fichier dans une session d'agent, sur les fichiers indexés avant un commit, et dans le pipeline de la pull request, dont le job gate est la vérification requise ; la revue humaine vient après une porte verte et juge la conception](../assets/diagrams/team-workflow-checks.fr.svg)

## Accueillir un nouvel arrivant en une journée

| Quand | Quoi | Pourquoi |
|---|---|---|
| première heure | lire `docs/context-map.md`, puis le `CONTEXT.md` du contexte qu'il rejoint ; lancer `npx ddd-ts-kit list` et `npx ddd-ts-kit describe <context>` | la carte avant le territoire |
| deuxième heure | `npm install`, `npm run infra:up`, `npm run dev`, ouvrir `/docs` ; lancer `npm run verify` (avec pnpm, le défaut d'`init` : `pnpm install`, `pnpm run <script>` ; le README du projet les écrit comme le fait son gestionnaire de *packages*) | prouver que la machine fonctionne avant de changer quoi que ce soit |
| matinée | lire une tranche existante de haut en bas : route, commande, gestionnaire, agrégat, leurs *specs* | l'arborescence est la même dans chaque contexte, une seule tranche les enseigne donc toutes |
| après le déjeuner | avec le propriétaire, choisir un petit cas d'usage réel ; le reformuler dans les mots du glossaire | la première conversation porte sur le langage |
| après-midi | le construire avec le générateur : remplir les emplacements `TODO(domain)`, remplacer les entrées `it.todo`, enfreindre une règle exprès et lancer `npx ddd-ts-kit explain <rule-id>` | les vérifications enseignent l'architecture plus vite qu'un document |
| fin de journée | ouvrir la *pull request* ; le propriétaire relit la conception, la porte a relu le reste | un changement fusionné dès le premier jour |

La commande de chacun de ces moments, et la référence de chaque option :
[Quelle commande, quand](commands.fr.md).

Ce qui rend cela possible, ce n'est pas la vitesse du nouvel arrivant mais l'arborescence fermée :
un fichier d'un rôle donné est toujours au même endroit, sous le même suffixe, si bien que la
connaissance d'un contexte se transpose au suivant.

## Limites et quand ne pas s'en servir

- **Un propriétaire par contexte demande assez de monde.** Une équipe de deux ne peut pas avoir
  six propriétaires ; la propriété est alors par personne avec un suppléant, et la règle de revue
  est « l'autre ».
- **Une propriété stricte ralentit un changement qui couvre plusieurs contextes.** Cette friction
  est voulue (c'est le coût du couplage rendu visible), mais si la plupart des changements
  couvrent les deux mêmes contextes, la frontière est fausse : fusionnez-les.
- **« Contrat d'abord » suppose que le contrat puisse être connu d'abord.** En pleine découverte,
  il ne le peut pas ; gardez les deux côtés dans un seul contexte jusqu'à ce que la forme se
  stabilise, puis séparez.
- **Les vérifications ne relisent pas la conception.** Un modèle peut passer toutes les règles et
  être faux quand même : le *checker* vérifie qu'un terme est dans le glossaire, pas qu'il veut
  dire la bonne chose.
- **Les fichiers de propriétaires du code, la protection de branche et les réglages des merge
  requests ne sont pas imposés par le kit.** Le *pipeline* fournit une description des réglages
  à appliquer (`branch-protection.md`, `merge-request-settings.md`) ; les appliquer est une étape
  manuelle, et le README du *pipeline* précise qu'ils ont été écrits à partir de la documentation
  des plateformes et non exécutés.

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 14 (carte des contextes,
  relations entre équipes).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitre 3.
- Matthew Skelton et Manuel Pais, *Team Topologies*, IT Revolution, 2019 (charge cognitive des
  équipes, manœuvre de Conway inverse).
- Michael Nygard, « Documenting Architecture Decisions », 2011.
- Conventional Commits 1.0.0, https://www.conventionalcommits.org/
- Ce dépôt : [pipeline/README.md](../../pipeline/README.md), les *skills* `bounded-contexts`,
  `glossary`, `context-map`, `document`, `deviation`.

## Voir aussi

- [Le travail en parallèle](parallel-work.fr.md)
- [La discipline des commits](commit-discipline.fr.md)
- [Méthodologie](methodology.fr.md)
- [Carte des contextes](../concepts/context-map.fr.md)
- [Langage omniprésent](../concepts/ubiquitous-language.fr.md)
- [Analyse statique et pipeline](../tools/static-analysis-and-pipeline.fr.md)
