[English](deploy-and-rollback.md) · **Français**
<!-- translation-of: deploy-and-rollback.md sha256:2e86077d9569a2c8 -->

# Déployer et revenir en arrière

**Résumé.** Le kit s'arrête à l'image : le *pipeline* la construit et ne pousse rien. Cette page
dit ce qu'un projet ddd-ts-kit livre au-delà de cette image (les migrations, le relais de
l'outbox, les *workers*, la route de disponibilité, l'export OpenTelemetry), dans quel ordre une
mise en production sort, ce que signifie revenir en arrière pour chaque pièce, et comment un
agent de code y prend part : trois niveaux d'autonomie rapportés aux environnements, déployer,
lire l'état et revenir en arrière en un script chacun, une garde avant la production, et un
retour arrière répété en préproduction avant que quoi que ce soit en ait besoin. Elle suit
l'étape de déploiement du
[playbook du cycle de vie AI-native d'Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf),
lu face à ce que le kit écrit. Le kit ne livre ni outil de déploiement ni serveur MCP : les
scripts de cette page sont ceux du projet, et la page le dit là où cela compte.

## Ce qu'un projet livre

| Pièce | Écrite par | Ce que c'est |
|---|---|---|
| l'image | le `Dockerfile` d'`init` | une construction en plusieurs étapes : `npm ci`, `npm run build` (les alias de `dist/` réécrits pour Node), puis une étape `node:24-slim` avec les seules dépendances de production, lancée sous `node`, sur le port 3000. `ENTRY` (un argument de construction, `dist/src/main.js` par défaut) choisit le processus : `dist/src/apps/worker/main.js` pour le *worker*, `dist/src/apps/<context>/main.js` pour un contexte lancé seul. Une image, plusieurs processus |
| les migrations | `npm run db:generate <what-it-does>` | `migrations/` (`prisma/migrations/` sur Prisma), appliquées par `npm run db:migrate` contre la base cible, comme une étape de la mise en production et jamais au démarrage du processus |
| l'API | `src/main.ts` | le serveur HTTP, les bus, les consommateurs d'événements d'intégration et, avec `--events outbox`, le relais de l'outbox (`startOutboxRelay`, toutes les `OUTBOX_RELAY_INTERVAL_MS`) : les événements qu'une commande a stockés sont publiés par ce processus |
| le *worker* | `npx ddd-ts-kit generate worker` | `src/apps/worker/main.ts` : les mêmes modules sans le serveur HTTP, les *jobs* planifiés démarrés quoi que dise `RUN_JOBS`, et `RUN_JOBS=false` par défaut pour l'API. Il ne fait tourner aucun relais de l'outbox : les événements que ses commandes stockent sont relayés par l'API |
| un contexte en service | `npx ddd-ts-kit generate service <context>` | `src/apps/<context>/main.ts`, ses *jobs* avec lui et hors de l'application entière, aucun *job* de la plateforme : la même image avec un autre `ENTRY`, le même `DEPLOYMENT_NAME` dans chaque conteneur ([quand extraire des microservices](when-to-extract-microservices.fr.md)) |
| la route de disponibilité | le démarrage HTTP de `src/platform/http/`, avec `--cache redis` seulement | `GET /health/ready` répond 200 quand Redis est joignable et 503 sinon, avant le limiteur de débit et toute route. Sans Redis le kit n'écrit aucune route de santé : une plateforme qui en sonde une a besoin d'une route que le projet ajoute. Aucune route de vivacité (*liveness*) n'est écrite |
| l'export OpenTelemetry | `src/platform/observability/` | les traces et les métriques par OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` (rien ne sort du processus quand elle n'est pas définie), `TRACE_SAMPLE_RATIO`, `OTEL_METRIC_EXPORT_INTERVAL` (60 secondes par défaut). `createMetrics()` de `create-metrics.ts` répond `openTelemetryMetrics()` de `@ddd-ts-kit/tracing`, sur le fournisseur de métriques (*meter provider*) que démarre `initTracing` : `use_case_*` pour chaque cas d'usage, `dependency_call_*` pour chaque appel d'adaptateur, les jauges `outbox_pending`, `outbox_failed` et `outbox_dead` que le relais pose depuis `store.stats()` après chaque passage, et `jobs_waiting`, `jobs_running` et `jobs_dead` par file de *jobs* d'arrière-plan là où un *worker* les exécute. L'âge du plus ancien enregistrement en attente est le SQL de [boucler la boucle](closing-the-loop.fr.md) ([observabilité](../concepts/observability.fr.md)) |
| la configuration | `src/platform/config/` | des variables d'environnement lues une fois au démarrage (`.env.example`, à la racine du projet, les liste) : une variable fausse arrête le processus avant qu'il écoute, pas à la première requête. Derrière un répartiteur de charge, `TRUST_PROXY` nomme les proxys crus quand ils donnent l'appelant dans `X-Forwarded-For` (un nombre de sauts, ou leurs adresses) ; sans elle, aucun ne l'est, et tous les appelants partagent l'adresse du répartiteur, et une seule fenêtre de la limite de débit |

`docker-compose.yml` et `npm run infra:up` sont l'infrastructure locale d'un développeur, pas un
déploiement.

## L'ordre d'une mise en production

1. **Migrer, de façon compatible vers l'avant.** Une migration d'une mise en production ajoute :
   une table, une colonne avec une valeur par défaut, un index. Elle ne renomme ni ne supprime
   rien que la version encore en marche lit, pour que l'ancien processus et le nouveau tournent
   sur le même schéma pendant la bascule. Une contraction (la suppression d'une colonne que plus
   rien ne lit) est une migration d'une mise en production ultérieure. Un événement stocké ne
   change de forme que par une nouvelle version avec son *upcaster* (`stored-events.lock.json`,
   `event-sourcing/upcaster-required`) : la version qui lit la nouvelle forme sort avant celle qui
   l'écrit.
2. **Déployer l'image**, une instance à la fois : l'API, puis le *worker* et les services, tous
   depuis la même étiquette. Là où la route de disponibilité existe, la plateforme envoie le
   trafic à une instance dès qu'elle répond 200. Deux versions tournent côte à côte le temps du
   roulement : les deux acceptent le schéma de l'étape 1, et le consommateur d'un événement
   d'intégration tolère la charge utile de la version d'avant et celle d'après, comme l'exige le
   [travail en équipe](team-workflow.fr.md).
3. **Relayer.** Les lignes de l'outbox écrites par l'ancien processus sont publiées par le
   nouveau : le relais les lit dans l'ordre et marque chacune envoyée, et un consommateur est
   idempotent (`events/consumer-idempotent`). Rien ne se perd dans la bascule, et une livraison
   répétée par la bascule est sans effet.

| Étape | Commande | Sort avec un code non nul quand |
|---|---|---|
| migrer | `npm run db:migrate` avec la `DATABASE_URL` de la cible | une migration échoue : rien n'est déployé |
| déployer | celle de la plateforme : l'étiquette d'image de l'exécution du *pipeline* qui l'a construite | une instance ne répond jamais disponible |
| lire l'état | la route de disponibilité, la profondeur de l'outbox (les jauges `outbox_*`, que le relais pose depuis `store.stats()`, ou le SQL de [boucler la boucle](closing-the-loop.fr.md)) et le taux d'erreur `use_case_*` de la nouvelle version, lus dans le stockage de métriques que l'export OTLP alimente | une valeur sort de sa bande |

## Ce que signifie revenir en arrière pour chaque pièce

| Pièce | Revenir en arrière, c'est | Demande |
|---|---|---|
| l'image | l'étiquette précédente déployée à nouveau, de la même façon | rien d'autre quand la migration était additive |
| une migration additive | rien : l'ancien processus ignore la colonne ou la table qu'il ne connaît pas | rien |
| une contraction | jamais annulée : une colonne supprimée a disparu. La correction est une mise en production vers l'avant | la contraction gardée une version derrière le code qui cesse de lire |
| l'outbox | rien : les lignes que la version retirée a écrites sont relayées par la version qui tourne après elle, dans le même format | la charge utile d'un événement publié par la nouvelle version lue par les consommateurs de l'ancienne : la tolérance de l'étape 2 |
| un consommateur | le gestionnaire précédent, qui lit la version de l'événement qu'il connaît | la nouvelle version du producteur publiée à côté de l'ancienne, jamais à sa place ([versionnement des événements](../concepts/event-versioning.fr.md)) |
| les *jobs* | rien : un *job* envoie une commande, idempotente par construction ; une période exécutée deux fois pendant la bascule est sans effet | |
| les événements stockés | le lecteur précédent, qui doit connaître chaque version déjà stockée | l'*upcaster* déployé une version avant l'écrivain, comme le dit l'étape 1 |
| le journal d'audit | rien : la chaîne enregistre ce qui a tourné, y compris ce qu'a fait la version retirée | |

`knex migrate:rollback` et ses équivalents existent et servent à la base d'un développeur : sur
une cible, une étape destructrice n'est jamais rejouée à l'envers.

## Trois niveaux d'autonomie, sur les environnements

Le playbook gradue ce qu'un agent peut faire selon l'environnement. Sur un projet ddd-ts-kit :

| Environnement | L'agent | Qui autorise | Tenu par |
|---|---|---|---|
| développement (le compose d'un développeur, un environnement de prévisualisation par branche) | déploie, lit l'état et revient en arrière de lui-même | personne : l'environnement est jetable | la liste `allow` de `.claude/settings.json` |
| préproduction | déploie et lit l'état ; répète le retour arrière (ci-dessous) ; écrit ce qu'il a vu dans le rapport de sa *story* | une personne lit le rapport avant la mise en production | la liste `allow`, restreinte aux scripts de préproduction |
| production | prépare : l'étiquette, le plan de migration, l'état qu'il attend, le retour arrière qu'il a répété ; ne lance rien | une personne, nommée, avec un identifiant de changement | `.claude/hooks/production-gate.mjs`, écrit par `init --agent-profile regulated` : une commande qui nomme l'environnement de production est bloquée tant que `RELEASE_APPROVAL` ne nomme pas un approbateur et un identifiant de changement, et le refus dit qui peut le définir |

La garde est un *hook* de Claude Code ; Codex et Copilot ne l'exécutent pas. Là, les scripts de
production restent hors de toute liste `allow`, et l'autorisation propre à la plateforme (un
environnement protégé, une étape d'approbation) est la garde.

## Déployer, lire l'état et revenir en arrière en un script chacun

Le projet écrit trois scripts, que le kit ne génère pas parce qu'ils dépendent de la
plateforme : `scripts/deploy.sh <environment> <tag>`, `scripts/status.sh <environment>`,
`scripts/rollback.sh <environment>`. Chacun imprime une ligne par étape, sort avec un code non
nul au premier échec, et peut être lancé deux fois (un second déploiement de la même étiquette ne
change rien). Le script de retour arrière est le déploiement de l'étiquette précédente plus la
lecture de l'état : rien qu'une personne ne taperait pas.

Un agent les atteint d'une façon ou de l'autre, jamais les deux :

- **par un serveur MCP de l'équipe plateforme**, qui expose `deploy`, `status` et `rollback`
  comme des outils limités à un environnement et détient les identifiants : l'agent ne voit
  jamais un jeton, le serveur journalise chaque appel, et l'outil de production vérifie lui-même
  l'approbation ;
- **par la liste `allow`** de `.claude/settings.json`, comme `init` écrit la boucle intérieure :
  `Bash(scripts/status.sh *)`, `Bash(scripts/deploy.sh staging *)`,
  `Bash(scripts/rollback.sh staging *)`, avec les identifiants dans l'environnement de la
  session et les scripts de production absents de la liste.

Deux chemins voudraient dire deux audits et deux jeux d'identifiants ; celui que l'équipe choisit
est celui que le *hook* ci-dessus garde. Le [guide du bac à sable](agent-sandbox.fr.md) dit
lequel tourne à l'intérieur du bac à sable de l'agent (le *shell*) et lequel à l'extérieur (un
serveur MCP).

## La répétition

Un retour arrière qui n'a jamais été joué n'est pas un retour arrière. En préproduction, à
intervalle régulier (un *job* hebdomadaire de la plateforme, ou du *pipeline* avec ses
identifiants), l'étiquette précédente est déployée par-dessus l'actuelle, l'état est lu, puis
l'étiquette actuelle est déployée à nouveau, et les deux lignes d'état sont gardées. Le même
script, le même format d'étiquette et le même état qu'en production, pour que
[boucler la boucle](closing-the-loop.fr.md) puisse l'appeler quand une détection se déclenche, par
un agent en préproduction et par une personne avec l'approbation en production.

## La part du *pipeline*

Le *pipeline* construit l'image et ne pousse rien : pousser l'étiquette et la déployer revient à
la plateforme, après le *job* `gate`. Quand une exécution échoue, l'extra `claude-triage`
(`init --ci-extras claude-triage`, [le pipeline](../../pipeline/README.md#free-by-default-paid-on-request))
est la première étape en lecture seule que recommande le playbook : trois lignes sur la *pull
request*, la cause la plus probable, instable ou réel, quoi faire ; il ne relance rien et ne
change rien.

## Ce que le kit ne fait pas

- Pas d'outil de déploiement, pas de serveur MCP, pas d'API de plateforme : les trois scripts et
  le serveur qui les expose sont ceux du projet et de l'équipe plateforme.
- Pas de route de santé sans Redis, et pas de route de vivacité : une plateforme qui en sonde une
  obtient une route que le projet ajoute dans `src/platform/http/`.
- Pas d'orchestration d'une mise en production *blue-green* ou *canary* : l'ordre ci-dessus est
  ce dont les pièces ont besoin, quoi que la plateforme en fasse.
- `ddd-ts-kit measures` lit le cycle de vie d'une *story* dans git et les fichiers de
  `docs/architecture/` ; le délai de déploiement et le taux d'échec d'une mise en production
  viennent de la plateforme, pas du kit.

## Voir aussi

- [Travail en équipe](team-workflow.fr.md) : le consommateur qui tolère les deux mondes, l'ordre
  d'un changement qui traverse deux contextes
- [Versionnement des événements](../concepts/event-versioning.fr.md), [Observabilité](../concepts/observability.fr.md)
- [Quand extraire des microservices](when-to-extract-microservices.fr.md) : un contexte en service
- [Isoler les agents de code](agent-sandbox.fr.md) : ce qui tourne à l'intérieur du bac à sable de l'agent
- [Quelle commande, quand](commands.fr.md#publier-et-déployer) : les commandes d'une mise en production
