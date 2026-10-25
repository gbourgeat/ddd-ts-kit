[English](direction-from-neighbouring-tools.md) · **Français**
<!-- translation-of: direction-from-neighbouring-tools.md sha256:217424eb805bcb04 -->

# Proposition : où mener le kit, d'après ce que font les outils voisins

**Résumé.** Seize outils se tiennent près de ddd-ts-kit : des méthodes qui organisent le travail
d'un agent de code (GitHub Spec Kit, BMAD-METHOD, Superpowers, Kiro, Agent OS), des *plugins* qui
tiennent une architecture DDD (BULDEE/ai-craftsman-superpowers, Softtor/nestjs-hexagonal), des
outils qui tiennent les frontières d'import d'une arborescence TypeScript (Nx, Sheriff,
eslint-plugin-boundaries, dependency-cruiser, ArchUnitTS) et des briques d'exécution pour CQRS et
l'*event sourcing* (@nestjs/cqrs, Emmett, KurrentDB, Booster). Leur documentation a été lue le
2026-10-25. Cette page retient ce que l'un d'eux fait et que le kit ne fait pas, et en tire neuf
propositions, notées selon la valeur pour un utilisateur, le coût pour la construire et
l'entretenir, et la pertinence pour ce à quoi sert le kit : un *backend* TypeScript en DDD, tenu
par des outils. Elle liste aussi ce que la comparaison suggère et que cette page ne propose pas,
avec la raison. Rien ici n'est construit.

## État (2026-10-25)

**Proposé, non construit.** L'ordre ci-dessous est l'ordre de travail proposé : le palier
d'abord, puis la pertinence, puis la valeur rapportée au coût.

| # | Proposition | Vu chez | Valeur | Coût | Pertinence | Palier |
|---|---|---|---|---|---|---|
| 1 | [Dire exactement ce que fait la garde, et les vrais nombres](#1-dire-exactement-ce-que-fait-la-garde-et-les-vrais-nombres) | ai-craftsman-superpowers, nestjs-hexagonal | haute | faible | haute | maintenant |
| 2 | [Un guide pour composer le kit avec une méthode générale et avec Nx](#2-un-guide-pour-composer-le-kit-avec-une-méthode-générale-et-avec-nx) | Spec Kit, BMAD, Superpowers, Nx | haute | faible | haute | maintenant |
| 3 | [Des tests de propriétés proposés depuis les invariants et les critères](#3-des-tests-de-propriétés-proposés-depuis-les-invariants-et-les-critères) | Kiro | moyenne | faible à moyen | haute | maintenant |
| 4 | [La stack d'un projet existant lue dans son manifeste](#4-la-stack-dun-projet-existant-lue-dans-son-manifeste) | Agent OS | moyenne | faible | moyenne | maintenant |
| 5 | [Une *baseline* des constats du *checker*](#5-une-baseline-des-constats-du-checker) | dependency-cruiser, ESLint | haute | moyen | haute | ensuite |
| 6 | [Les règles de dépendance refusées avant l'écriture, à l'essai](#6-les-règles-de-dépendance-refusées-avant-lécriture-à-lessai) | ai-craftsman-superpowers, Kiro | moyenne | moyen | haute | ensuite |
| 7 | [Plus d'hôtes, choisis selon ce qu'ils exécutent](#7-plus-dhôtes-choisis-selon-ce-quils-exécutent) | Spec Kit, Superpowers | moyenne à haute | moyen, puis récurrent | moyenne | ensuite |
| 8 | [Un serveur MCP en lecture seule sur les faits d'un projet](#8-un-serveur-mcp-en-lecture-seule-sur-les-faits-dun-projet) | Nx, KurrentDB | moyenne | moyen | moyenne | ensuite |
| 9 | [Un *event store* KurrentDB, sur demande](#9-un-event-store-kurrentdb-sur-demande) | Emmett, KurrentDB | faible pour la plupart, haute pour quelques-uns | élevé | faible | plus tard |

## Lire les notes

| Note | Haute | Moyenne | Faible |
|---|---|---|---|
| **Valeur** | la plupart des utilisateurs y gagnent, ou elle lève une raison de ne pas adopter le kit | une partie des utilisateurs y gagne, ou elle fait gagner du temps sans changer ce qui est possible | quelques utilisateurs y gagnent |
| **Coût** | des semaines, un nouveau *package* ou un nouveau protocole à tenir, ou un coût que paie chaque *release* | des jours, une commande ou un *hook* modifié, avec ses tests | quelques heures à deux jours, de la documentation ou un petit changement de la CLI |
| **Pertinence** | elle sert ce à quoi sert le kit : des règles tenues par des outils sur un *backend* TypeScript en DDD | elle élargit qui peut utiliser le kit sans changer ce qu'il tient | elle sert un autre but, ou un utilisateur sur beaucoup |

Le coût compte la construction, les tests que demandent les règles du kit (suites de contrat,
exécutions de bout en bout, la page française) et ce que paie ensuite chaque *release*. Une
proposition que la comparaison suggère mais dont la pertinence est faible et le coût élevé n'est
pas proposée : elle figure sous
[Ce que cette page ne propose pas](#ce-que-cette-page-ne-propose-pas).

## Ce que la comparaison a montré

Le kit emprunte à chaque famille, sur un périmètre plus étroit, et la comparaison a trouvé trois
endroits où un voisin va plus loin :

- **La portée.** Spec Kit liste 41 intégrations d'agents, Superpowers 16 environnements ; le kit
  a trois hôtes (Claude Code, Codex, GitHub Copilot). Sans le *plugin*, tout agent qui lit
  `AGENTS.md` reçoit encore les règles et les commandes, mais ni les *skills* ni la garde.
- **Le moment du refus.** ai-craftsman-superpowers refuse une violation de couches dans un *hook*
  qui s'exécute avant l'écriture ; les *hooks* Pre Tool Use de Kiro peuvent bloquer un outil, une
  fois que quelqu'un les a écrits. La garde du kit refuse quatre cas précis avant l'écriture (un
  fichier d'un rôle généré écrit à la main, le code d'une *story* avant sa barrière, une écriture
  d'un *worker* hors de son contexte, une *spec* verrouillée), et vérifie chaque fichier
  TypeScript et chaque `CONTEXT.md` juste après son écriture, avec les règles qui jugent un
  fichier, puis refuse une fois de s'arrêter tant qu'une erreur demeure.
- **L'intégration aux agents et à l'outillage autour d'eux.** Nx livre un serveur MCP
  (`nx_workspace`, `nx_project_details`, `nx_docs`, les générateurs) ; KurrentDB en a un pour
  explorer flux et projections. Kiro dérive des tests de propriétés des exigences. Le kit n'a ni
  serveur MCP ni propriété dérivée d'un critère : ses propriétés s'écrivent à la main, et
  `fast-check` s'ajoute avec la première.

La comparaison a aussi montré où le kit va plus loin, ce qui borne les propositions : 122 règles
avec un identifiant, 42 sortes de briques générées, 25 *packages* d'exécution, des tests
gouvernés (suites de contrat, seuils de mutation par couche), les données personnelles du code
généré. Aucune proposition n'en échange une part contre de la portée.

## 1. Dire exactement ce que fait la garde, et les vrais nombres

**Vu chez.** ai-craftsman-superpowers résume sa promesse en « A prompt asks. This enforces. » et
refuse avant l'écriture ; nestjs-hexagonal vérifie après l'écriture et bloque un sous-agent à son
arrêt, deux fois au plus. Qui compare le kit avec eux lit le README du kit.

**Le kit aujourd'hui.** Le README du dépôt dit que « the hook of the plugin refuses a write that
breaks a rule », ce que fait ai-craftsman-superpowers et non ce que fait la garde (voir
[Ce que la comparaison a montré](#ce-que-la-comparaison-a-montré)). Il donne aussi des nombres en
retard sur le code : 36 sortes de briques (le générateur en a 42), vingt-deux *skills* et cinq
agents (le *plugin* a 26 *skills* et 6 agents ; l'index de la documentation dit vingt-cinq), et
« les neuf étapes » là où `/ddd-ts-kit:start` en conduit sept (la méthodologie en a neuf ; la
barrière et les documents reviennent à chaque tranche).

**La proposition.** Une *pull request* de documentation : la phrase sur la garde réécrite selon
ce qu'elle fait (elle refuse quatre cas avant l'écriture, vérifie le fichier écrit juste après et
nomme la règle enfreinte à l'agent, refuse une fois de s'arrêter tant qu'une erreur demeure, tient
toutes les règles avant la fusion et dans le *pipeline*) ; les nombres corrigés ; et un test de la
documentation qui lit les nombres dans la source (les sortes de `generate --help`, les *skills* et
les agents de `plugin/`) et échoue quand un README en annonce un autre, comme un test échoue déjà
quand la section 3 de la référence d'architecture nomme une règle que le *checker* ne connaît pas.

**Valeur : haute.** Une affirmation qu'un lecteur peut vérifier et trouver fausse coûte plus de
confiance que la fonctionnalité n'en rapporte. **Coût : faible.** Quelques heures, et un test de
quelques dizaines de lignes. **Pertinence : haute.**

## 2. Un guide pour composer le kit avec une méthode générale et avec Nx

**Vu chez.** Spec Kit (constitution, spécification, plan, tâches), BMAD-METHOD (des rôles produit,
architecte, UX et test, du *brief* aux *stories*) et Superpowers (des *skills* de TDD et de
planification, un *hook* SessionStart qui charge la méthode) organisent le travail d'un agent pour
tout langage ; Nx tient un *monorepo*, son graphe de projets, son cache et les frontières entre
ses projets.

**Le kit aujourd'hui.** Son *workflow* de *story* part d'un énoncé des besoins et finit à une
*pull request*, pour un *backend*. Rien dans la documentation ne dit comment une équipe qui
utilise déjà l'un de ces outils ajoute le kit : quel artefact de l'un devient l'entrée de quelle
étape du kit, où les deux agiraient au même moment (deux *skills* de TDD, deux étapes de
planification, deux *hooks* à l'ouverture d'une session) et lequel doit le tenir.

**La proposition.** Un guide, `docs/guides/with-other-tools.md`, une section par outil, chacune
écrite depuis une vraie session sur un petit projet :

- Spec Kit et BMAD : leur spécification ou leurs *stories* comme énoncé des besoins de
  `discover-domain` et d'une *story* ; leurs documents produit et UX leur restent, l'architecture
  du *backend* est tenue par le kit.
- Superpowers : ce que les deux disent des tests (un test qui échoue d'abord, un *mock* seulement
  pour une dépendance lente ou externe), pour que les deux jeux de *skills* ne se contredisent
  pas, et lequel conduit une session.
- Nx : un projet du kit comme un seul projet Nx, ou un par contexte délimité, et comment la règle
  de frontières de modules de Nx et le *checker* du kit se partagent le travail au lieu de
  signaler deux fois le même import.

**Valeur : haute.** Les publics de Superpowers (304,6 k étoiles) et de Spec Kit (142,7 k étoiles)
sont bien plus larges que celui du kit ; une équipe qui devrait choisir entre sa méthode et le kit
choisit sa méthode. **Coût : faible.** Un guide et quatre sessions d'essai, avec sa page
française. **Pertinence : haute.** Le kit tient le *backend*, la méthode cadre le produit : le
guide le dit au lieu de les mettre en concurrence.

## 3. Des tests de propriétés proposés depuis les invariants et les critères

**Vu chez.** Kiro dérive des tests de propriétés des exigences d'une spécification
([correctness](https://kiro.dev/docs/specs/correctness/)).

**Le kit aujourd'hui.** La *skill* `testing` énonce une loi qu'un *value object* tient pour toute
valeur comme une propriété avec `fast-check`, écrite à la main, et `fast-check` rejoint les
dépendances de développement avec la première propriété. Les critères d'acceptation d'une *story*
sont écrits et verrouillés comme des scénarios, par l'exemple.

**La proposition.** Deux étapes, la seconde seulement si la première le mérite :

1. `generate property <context> <ValueObject>` : une *spec* avec les *arbitraries* que la
   *factory* du *value object* accepte et refuse, un `it.todo` par loi à énoncer, et `fast-check`
   ajouté aux dépendances de développement s'il manque.
2. Dans la revue de conception d'une *story*, un critère qui énonce une loi sur toutes les valeurs
   (« jamais négatif », « le total égale la somme des lignes ») est marqué, et la *story* propose
   une propriété à côté de ses scénarios.

**Ce qui le prouverait.** Sur l'exemple, le score de mutation du domaine avec et sans les
propriétés de ses *value objects*, et les survivants qu'elles tuent.

**Valeur : moyenne.** Une propriété trouve les cas limites que les exemples manquent ; la mutation
mesure déjà ce que les tests laissent passer, le gain est donc mesurable. **Coût : faible à
moyen.** Une sorte de générateur avec son *template*, sa *spec* et son exécution de bout en bout ;
un paragraphe dans deux *skills*. **Pertinence : haute.**

## 4. La stack d'un projet existant lue dans son manifeste

**Vu chez.** Agent OS découvre les conventions d'un code existant et les écrit pour l'agent.

**Le kit aujourd'hui.** `init` sur un projet existant saute les fichiers qui existent, et prend la
*stack* dans ses options ou ses défauts (Express, zod, Drizzle, Vitest, RBAC). Un projet sur
Fastify, Prisma et Jest doit le dire en cinq options, et une option oubliée écrit le défaut.

**La proposition.** `init --dry-run` dans un répertoire qui a un `package.json` lit ses
dépendances, propose les options qui correspondent (`--http fastify --orm prisma --tests jest ...`)
et nomme chaque valeur qu'il n'a pas pu déduire ; la *skill* `bootstrap` soumet la proposition au
*owner*. Rien n'est écrit sans que les options soient données.

**Valeur : moyenne.** Elle évite un défaut faux sur un projet existant, la première impression du
kit à cet endroit. **Coût : faible.** Une table des noms de *packages* vers les valeurs de *stack*,
et sa *spec*. **Pertinence : moyenne.** Elle aide l'adoption ; elle ne change pas ce qui est tenu.

## 5. Une *baseline* des constats du *checker*

**Vu chez.** dependency-cruiser enregistre les violations connues d'un code et ne signale que les
nouvelles (`--baseline`, `--ignore-known`,
[référence de la CLI](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md)) ;
ESLint fait de même avec ses suppressions en masse.

**Le kit aujourd'hui.** Le *preset* ESLint d'un projet peut enregistrer les constats qu'un code
existant a déjà dans `eslint-suppressions.json`, qui ne fait ensuite que rétrécir
([Analyse statique et pipeline](../tools/static-analysis-and-pipeline.fr.md)). Le *checker* n'a pas
d'équivalent : `check --changed-since <ref>` limite une exécution aux fichiers qu'un changement a
touchés, et chaque constat d'un fichier touché compte, ancien ou nouveau. Une équipe qui fait
entrer un *backend* existant dans l'arborescence canonique un contexte à la fois corrige tous les
constats d'un fichier qu'elle touche, ou enregistre une déviation par règle.

**La proposition.** `check --baseline write` enregistre les constats du *checker* sous forme de
règle, de fichier et d'une empreinte du code signalé qui survit au déplacement des lignes ;
`check --baseline <file>` ne signale que les constats qui n'y sont pas, et échoue quand le fichier
garde un constat disparu, pour qu'il ne fasse que rétrécir. La garde et le *pipeline* lisent le
même fichier. Sa limite, dite dans la documentation : une *baseline* fait taire les anciens
constats, elle ne rend pas vérifiable une arborescence hors de l'arborescence canonique.

**Valeur : haute.** L'adoption sur du code qui existe est le cas le plus fréquent, et c'est
aujourd'hui le plus difficile. **Coût : moyen.** Une empreinte stable est la partie difficile ;
viennent ensuite la garde, le *pipeline*, `doctor` et la documentation. **Pertinence : haute.**

## 6. Les règles de dépendance refusées avant l'écriture, à l'essai

**Vu chez.** ai-craftsman-superpowers refuse une violation de couches dans un *hook* qui s'exécute
avant l'écriture ; les *hooks* Pre Tool Use de Kiro peuvent bloquer un outil.

**Le kit aujourd'hui.** Les règles qui jugent un fichier s'exécutent juste après l'écriture, et
l'agent lit aussitôt la règle enfreinte. Entre-temps le fichier est sur le disque, ce qui compte
quand une session se termine avant la correction, et l'agent écrit deux fois.

**La proposition.** À l'essai, derrière une valeur du réglage `guard` : dans `pre-write`, pour les
seules règles de dépendance (les couches qu'un fichier peut importer, le langage publié entre
contextes), la garde applique l'écriture au texte actuel (le contenu entier d'un `Write`, les
remplacements d'un `Edit`, le *patch* de Codex) et refuse avec le message que donne le *checker*.
Les autres règles restent après l'écriture : elles jugent du code qu'un agent est peut-être encore
en train d'écrire.

**Ce qui le prouverait.** Un mois de sessions sur l'exemple : les écritures refusées, les refus
injustifiés (un déplacement de fichiers dont l'écriture suivante corrige les imports est le cas
connu), le temps que le *hook* ajoute à chaque écriture face à son budget de 5 s.

**Valeur : moyenne.** La vérification après l'écriture nomme déjà la règle aussitôt ; le gain est
qu'aucun fichier fautif n'atteint le disque, et une écriture au lieu de deux. **Coût : moyen.**
Trois formats d'écriture, le budget du *hook*, les refus d'un *refactoring* en cours.
**Pertinence : haute.**

## 7. Plus d'hôtes, choisis selon ce qu'ils exécutent

**Vu chez.** Spec Kit liste 41 intégrations d'agents, Superpowers 16 environnements.

**Le kit aujourd'hui.** Claude Code, Codex et GitHub Copilot, chacun avec les *skills* et la
garde ; les six agents sont des sous-agents de Claude Code. Tout autre agent qui lit `AGENTS.md`
reçoit les règles et les commandes, sans la garde.

**La proposition.** Un hôte est ajouté quand il exécute les deux choses dont le kit est fait : des
*skills*, et des *hooks* qui peuvent refuser un appel d'outil et lire l'écriture d'un fichier.
Deux candidats dont la documentation décrit des *hooks* capables de refuser un appel d'outil, à
vérifier dans une vraie session avant toute promesse : Cursor
([hooks](https://cursor.com/docs/agent/hooks)) et Gemini CLI
([hooks reference](https://geminicli.com/docs/hooks/reference/)). Pour chacun, une section de
[Le plugin pour les agents de code](../guides/coding-agents.fr.md) dit ce qui s'y exécute et ce
qui ne s'y exécute pas, comme la page le dit aujourd'hui pour Codex.

**Valeur : moyenne à haute.** Chaque hôte apporte ses utilisateurs. **Coût : moyen, puis
récurrent.** La garde lit le format de chaque hôte, et chaque hôte change son format à son propre
rythme ; la suite de tests de la garde grandit d'un hôte à chaque fois. **Pertinence : moyenne.**
Elle élargit qui utilise le kit sans changer ce qu'il tient.

## 8. Un serveur MCP en lecture seule sur les faits d'un projet

**Vu chez.** Nx livre un serveur MCP (`nx_workspace`, `nx_project_details`, `nx_docs`, les
générateurs, [référence](https://nx.dev/docs/reference/nx-mcp)) ; KurrentDB en a un pour explorer
ses flux et ses projections.

**Le kit aujourd'hui.** Les faits sont des commandes qu'un agent lance dans un *shell* :
`describe <context>`, `list --json`, `rules`, `explain <rule>`, `status`, `check-file <path>`.

**La proposition.** `ddd-ts-kit mcp`, un serveur stdio qui expose ces commandes comme des outils en
lecture seule, et `generate --dry-run` comme le seul qui nomme des fichiers, écrit sans dépendance
comme le reste de la CLI. Rien qui écrive : l'écriture reste aux générateurs, sous la garde.

**Valeur : moyenne.** Pour un hôte qui a un *shell*, peu change ; le gain, ce sont des réponses
structurées, les hôtes dont le *shell* est fermé ou demande à chaque fois, et les hôtes de la
proposition 7. **Coût : moyen.** Le protocole à la main, un schéma par outil tenu avec les
commandes, ses tests. **Pertinence : moyenne.** Elle devrait venir après la proposition 7, qui dit
quels hôtes en ont besoin.

## 9. Un *event store* KurrentDB, sur demande

**Vu chez.** Emmett tourne sur PostgreSQL, EventStoreDB, MongoDB et SQLite ; KurrentDB est une base
faite pour les flux d'événements.

**Le kit aujourd'hui.** L'*event store* est dans la base de l'ORM du projet, sur PostgreSQL, pour
que les événements, l'*outbox* et les événements traités partagent une transaction.
[Event sourcing](../concepts/event-sourcing.fr.md) pèse déjà KurrentDB comme un adaptateur
ultérieur, et dit pourquoi pas maintenant : pas de transaction partagée avec l'*outbox*, des
positions qui sont des *offsets* plutôt que les numéros sans trou que le contrat énonce, un client
et un serveur trop lourds pour les suites de ce dépôt.

**La proposition.** Rien avant qu'un utilisateur le demande avec un projet qui en a besoin. Alors,
l'*outbox* lue depuis un abonnement du *store*, et une suite de contrat qui énonce des positions
ordonnées plutôt que sans trou.

**Valeur : faible pour la plupart, haute pour quelques-uns.** **Coût : élevé.** **Pertinence :
faible.** Une équipe pour qui l'*event sourcing* est le cœur du système est mieux servie par
Emmett ou KurrentDB directement, comme le dit la comparaison.

## Ce que cette page ne propose pas

| Suggéré par | Quoi | Pourquoi pas |
|---|---|---|
| Spec Kit, Superpowers, ai-craftsman-superpowers | d'autres langages que TypeScript | la valeur du kit est sa profondeur sur une seule *stack* : générateurs, *packages* d'exécution, suites de contrat, *checker* ; un second langage diviserait chacun par deux |
| BMAD-METHOD | des rôles produit et UX | une méthode générale le fait mieux ; la proposition 2 compose avec elle |
| Nx | orchestrer un *monorepo*, un cache de tâches | l'[étude de la vélocité du build](build-and-test-velocity.fr.md) a mesuré ce dépôt et n'a gardé aucun orchestrateur ; un projet qui en a besoin garde Nx, proposition 2 |
| nestjs-hexagonal | refuser l'arrêt deux fois au lieu d'une | le second refus des mêmes erreurs fait plus tourner en boucle qu'il ne corrige ; le *pipeline* tient ce qui reste |
| Spec Kit | un catalogue d'extensions ouvert aux tiers | [Quels contextes méritent un *preset*](context-presets.fr.md) fixe d'abord les critères d'un *preset* ; un catalogue demande une gouvernance que le kit n'a pas encore |

## Limites de cette page

La comparaison a lu la documentation et le dépôt de chaque outil le 2026-10-25, pas leur code en
session ; un outil peut faire plus que ce que dit sa documentation. Les nombres d'étoiles ont été
relevés par l'API GitHub le même jour. Les notes sont un jugement, argumenté dans chaque section,
pas une mesure : chaque proposition dit ce qui la prouverait une fois construite.

## Sources

Consultées le 2026-10-25.

- GitHub Spec Kit : <https://github.com/github/spec-kit>, <https://github.github.io/spec-kit/integrations/index.html>
- BMAD-METHOD : <https://github.com/bmad-code-org/BMAD-METHOD>
- Superpowers : <https://github.com/obra/superpowers>, ses *hooks* <https://github.com/obra/superpowers/blob/main/hooks/hooks.json>
- Kiro : <https://kiro.dev/docs/specs/>, <https://kiro.dev/docs/hooks/types/>, <https://kiro.dev/docs/specs/correctness/>
- Agent OS : <https://github.com/buildermethods/agent-os>
- ai-craftsman-superpowers : <https://github.com/BULDEE/ai-craftsman-superpowers>
- nestjs-hexagonal : <https://github.com/Softtor/nestjs-hexagonal>
- Nx : <https://nx.dev/docs/features/enforce-module-boundaries>, <https://nx.dev/docs/reference/nx-mcp>
- dependency-cruiser : <https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md>
- *Hooks* de Cursor : <https://cursor.com/docs/agent/hooks>
- *Hooks* de Gemini CLI : <https://geminicli.com/docs/hooks/reference/>
- Emmett : <https://github.com/event-driven-io/emmett>
- KurrentDB : <https://github.com/kurrent-io/KurrentDB-Client-NodeJS>

## Voir aussi

- [Le plugin pour les agents de code](../guides/coding-agents.fr.md) : ce que fait la garde, hôte
  par hôte
- [Analyse statique et pipeline](../tools/static-analysis-and-pipeline.fr.md) : le *checker*,
  ESLint, dependency-cruiser, et l'adoption du kit dans un code existant
- [Stratégie de test](../concepts/testing-strategy.fr.md) : propriétés, suites de contrat, mutation
