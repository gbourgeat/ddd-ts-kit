[English](story-workflow.md) · **Français**
<!-- translation-of: story-workflow.md sha256:a358a00edb76ba7a -->

# Parcours d'une story : une session par user story

**Résumé.** Une *user story* traverse des contextes ; une session d'un agent de code peut la
mener seule de son énoncé à une *pull request* verte, pourvu que les questions viennent d'abord
et le code en dernier. `/ddd-ts-kit:story <code>` le fait dans son propre *worktree* git : il pose
d'un coup toutes les questions au responsable du projet, puis écrit le fichier de la *story* et
ses critères d'acceptation, les lignes de la *story*, une revue de conception de chaque ligne et
les tests d'acceptation, verrouillés, avant tout code ; il construit ligne par ligne avec un
agent confiné à un contexte, relit, vérifie, ouvre la *pull request* et rend compte de chaque
décision prise sans le responsable. Plusieurs terminaux mènent plusieurs *stories* à la fois. La
garde du plugin tient l'ordre : pas de code avant la conception et l'acceptation.

## Quand l'utiliser

- Un projet est amorcé et ses contextes existent (étapes 1 à 5 de la
  [méthodologie](methodology.fr.md)) ; la *story* y entre, ou les questions de la phase 1 disent
  qu'elle n'y entre pas.
- Une *story* à la fois par session. Pour construire en même temps plusieurs contextes d'un même
  plan, voir plutôt le [travail en parallèle](parallel-work.fr.md) ; le parcours d'une *story*
  reprend ses *worktrees*, ses consignes et ses règles de fusion.

```text
terminal 1 : /ddd-ts-kit:story US5 "Un client passe une commande et reçoit sa facture"
terminal 2 : /ddd-ts-kit:story US6 docs/backlog/us6.md
terminal 3 : /ddd-ts-kit:story US7 docs/architecture/intents/faster-checkout.md
```

## D'où vient une story

Une *story* part de mots simples, d'un fichier, d'un ticket ou d'une intention. Une intention
est l'idée écrite par celui qui l'a, dans ses propres mots, avant que quiconque ne conçoive
quoi que ce soit : `/ddd-ts-kit:intent` réfléchit avec son auteur jusqu'à ce que l'idée soit
concrète (ce qui ne va pas, ce qui serait vrai une fois résolu, qui et quoi elle touche, les
contraintes, ce que l'auteur observerait), place les systèmes touchés sur `npx ddd-ts-kit list`
quand elle tourne dans le projet, et écrit `docs/architecture/intents/<slug>.md` depuis le
*template* de la *skill* story avec `Status: draft`. La personne la lance depuis Claude Code,
depuis Cowork ou claude.ai avec un connecteur git, ou remplit le *template* à la main. Le
responsable du produit corrige l'intention dans une *pull request* et l'accepte en posant
`Status: accepted` : la fusion est l'acceptation, et rien n'est décidé à sa place. La *story*
la lit ensuite, `npx ddd-ts-kit story-scope US7 --from docs/architecture/intents/faster-checkout.md`
(refusé tant que l'intention n'est pas acceptée) : `## Problem` et `## Proposed outcome`
amorcent `## Statement`, chaque contrainte est une question répondue « par l'intention », les
questions ouvertes rejoignent la phase 1, et chaque ligne de l'acceptation écrite par l'auteur
est le premier jet d'un critère. Un compte rendu d'incident
(`docs/architecture/incidents/<id>.md`, [boucler la boucle](closing-the-loop.fr.md)) est accepté
de la même façon, tel quel. Une intention
n'est pas un ticket : un projet dont le *tracker* est la source de vérité écrit la clé dans
l'intention et le chemin dans le ticket, et `## Origin` porte les deux.

## Les phases

| # | Phase | Artefact | Qui décide |
|---|---|---|---|
| 0 | son *worktree* : `npx ddd-ts-kit story-scope US5 [--from <intention ou incident>]` | `.worktrees/us5` sur `story/us5`, `.ddd-ts-kit/story.json` (`kind`, `from`) | |
| 1 | toutes les questions, d'un coup | `## Origin` et `## Questions` de `docs/architecture/stories/US5.md` | le responsable du projet, une fois |
| 2 | spécification et lignes | `## Acceptance criteria` (`- AC1: ...`), les lignes `US5.01`, ... de `slices.md` | la session |
| 3 | une revue de conception de chaque ligne | `docs/architecture/reviews/US5.md`, une section `## #US5.02 ...` par ligne, lue par `architecture-reviewer` | la session |
| 4 | l'acceptation, avant tout code | `test/acceptance/us5.acceptance.spec.ts` et son verrou | la session |
| 5 | la barrière de construction : `npx ddd-ts-kit story US5 --gate build` | la garde ouvre le code des contextes | |
| 6 | construire, ligne par ligne | un commit par ligne, un agent `context-builder` par ligne `slice` | la session |
| 7 | clore : tronc fusionné dans la branche, revue, `npm run verify`, `acceptance US5 --gate passing` | une branche verte | |
| 8 | le rapport, puis la *pull request* | `## Report` avec `### Verification`, le corps de la *pull request* | le responsable du projet, à la revue |

`npx ddd-ts-kit story US5` affiche les phases, ce que chacune contient et l'étape suivante ; une
session qui démarre dans le *worktree* d'une *story* reçoit la même chose de la garde.

## Les questions d'abord, puis des décisions provisoires

La phase 1 liste chaque question dont la réponse change un artefact : une règle métier que la
session devrait deviner, qui détient une permission, un terme manquant, un critère qui ne
s'observe pas, une frontière. Elles sont posées en un seul lot, chacune avec une option
recommandée. Ensuite la session ne s'arrête plus pour demander : elle prend l'option la plus
facile à défaire, la consigne comme `D1 (provisional)` avec sa raison, ses alternatives et
l'endroit du code où elle vit, et continue. Le rapport soumet chacune au responsable du projet.
Une frontière, un nouveau contexte ou un patron de relation ne se décide jamais ainsi : demandé en
phase 1, ou, quand il apparaît plus tard et que rien de réversible n'existe, la seule raison de
s'arrêter, avec un rapport qui le dit.

## La trace de la story

Le fichier de la *story* est la trace qu'un auditeur lit : qui a demandé (`## Origin`), qui a
répondu (`## Questions`), ce que la session a décidé seule (`D<n>`), sous quelles règles, et
qui a approuvé (la fusion de la *pull request*). `## Origin`, écrit en phase 1, tient en trois
lignes : `From:`, l'intention, le ticket ou l'incident d'où vient la *story* ; `Built with:`, la
version du kit et du plugin, la base et son *commit* ; `Policies in force:`, les *skills*
chargées en phase 3. `story --gate close` refuse une *story* sans ses lignes `From:` et
`Built with:`, et le corps de la *pull request* répète le bloc, si bien que le tronc renvoie à
l'origine de la *story*. Le rapport clôt la trace par `### Verification` : les dernières lignes
de `npm run verify`, de l'exécution de l'acceptation et de `story-check`, collées telles que
l'outillage les a imprimées, et `not verified:` pour ce qui n'a pas pu tourner (un *broker*, un
fournisseur, une plateforme) ; la barrière de clôture le lit aussi. Le bloc est ce que le
[playbook du cycle de vie natif de l'IA d'Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
demande comme preuve de gouvernance : la spécification, ce qui l'a produite et les politiques
en vigueur, consignées avec elle.

## La conception avant le code

Chaque ligne reçoit une section de la revue de conception avant que rien ne soit généré :
l'agrégat et ses invariants, la commande ou la requête et sa permission, les événements, les
erreurs par leur nom métier, la route, les ports, le contrat lu dans un autre contexte. L'agent
`architecture-reviewer` la lit comme une revue de conception de lignes à construire ; ses
remarques bloquantes changent la conception. Les politiques du projet sont des *skills*, celles
du plugin (contrôle d'accès, persistance, préoccupations transverses, tests) et celles du projet
sous `.claude/skills/` : la session liste celles qu'elle a chargées sur la ligne
`Policies in force:` de `## Origin`, et écrit dans la section d'une ligne
`Policies: <skill>: <ce qu'elle a imposé ici>` quand une politique a changé la conception, une
ligne que le relecteur lit avec le reste ; deux politiques qui se contredisent deviennent une
décision pour le responsable du projet. `npx ddd-ts-kit cited --rows <ids>` liste les noms que la
conception cite et que le tronc a remplacés entre-temps. `worker-scope` nomme la section d'une
ligne dans la consigne de son agent.

## L'acceptation avant le code, et verrouillée

Les critères d'acceptation deviennent des scénarios par l'API, un ou plusieurs par critère, dans
`test/acceptance/us5.acceptance.spec.ts`, chacun nommé d'après ses lignes et son critère
(`'#US5.02 AC1 ...'`) et enveloppé dans `pending(...)` jusqu'à ce que ses lignes soient
construites. On les exécute une fois pour voir chacun échouer sur une assertion, puis on les
verrouille : `npx ddd-ts-kit acceptance US5 --lock`. Un scénario verrouillé ne change qu'avec son
critère. Un critère changé après le verrou, ou un scénario qui ne correspondait pas à son
critère, est jugé avant d'être verrouillé à nouveau, par l'agent `acceptance-judge`, qui n'a pas
fait le changement : il compare la version verrouillée, la nouvelle, le critère et les réponses
du responsable du projet, et écrit un verdict pour cette version précise. Chaque verdict est un
amendement que le rapport liste pour que le responsable du projet le valide. Aucun agent ne fait
passer un test en le réécrivant : la garde ne laisse un sous-agent que retirer `pending(...)`, et
seul le juge écrit un verdict. Voir la [stratégie de test](../concepts/testing-strategy.fr.md)
et `ddd-ts-kit acceptance` dans les [commandes](commands.fr.md).

## Des agents confinés à un contexte, l'un après l'autre

Une *story* traverse des contextes, un *worker* non. Chaque ligne `slice` est construite par un
agent `context-builder`, qui reçoit sa consigne de
`npx ddd-ts-kit worker-scope <context> --here --rows <id>` dans le *worktree* de la *story* : la
garde le confine à ce contexte, et ses besoins bloquants (un champ d'un contrat, une dépendance,
un droit, une migration) reviennent à la session, qui les réalise sur la branche. Les agents
tournent l'un après l'autre dans l'unique *worktree* : les lignes d'une *story* dépendent le plus
souvent les unes des autres (contrat, producteur, consommateur), et le parallélisme est entre
les *stories*, une par terminal.

## À la clôture d'une story

Le tronc est fusionné dans la branche, l'agent `architecture-reviewer` lit la branche, et ses
constats sont corrigés ou écrits en marqueurs `TODO(review)` rattachés à leur ligne. La règle de
deux s'applique là : un constat qui répète un constat déjà consigné pour le projet (le même
identifiant de règle ou la même remarque dans un fichier de revue antérieur, ou un marqueur
`TODO(review)`) est écrit dans la même branche comme une ligne sous `## Mistakes seen here` de
`AGENTS.md`, ou comme une règle de `ddd-ts-kit.config.json` quand le kit en a une pour lui, pour
que la session suivante ne le fasse pas une troisième fois. La revue elle-même est gardée : la
session l'ajoute à `docs/architecture/reviews/<code>.md` sous `## Findings`, une ligne par
constat avec sa passe, son `file:line` et son issue (`fixed in <commit>`,
`written as TODO(review)`, `dismissed by ADR-<n>`), si bien que la trace survit à la *pull
request* et à un passage de GitHub à GitLab, et nourrit la règle de deux.

Une seconde lecture vient alors d'un contexte qui n'a pas construit le code : l'agent
`story-verifier`, en lecture seule, démarre l'application comme le font les tests de bout en
bout, exécute l'acceptation de la *story* et les *specs* de bout en bout des deux flux les plus
proches, appelle les routes que les *specs* laissent de côté quand le projet démarre sans
service, lit la revue de conception et le rapport, et rend compte de ce qu'il a exécuté, de ce
qu'il a vu, et de chaque comportement qui ne correspond pas à la conception ou à une décision
`D<n>`. Il ne corrige rien ; la session règle chaque écart comme un constat. Les tests
d'acceptation restent la vérification la plus forte, puisqu'ils échouent avant le code et que
l'agent qui construit ne peut pas les réécrire ; le vérificateur ajoute les flux voisins et une
lecture des compromis.

Une équipe qui veut distinguer les *commits* d'un agent de ceux d'une personne pose
`commit.agentTrailer` à `true` dans `ddd-ts-kit.config.json`
([configuration](../CONFIG.fr.md)) : la *skill* story, l'agent `context-builder` qu'elle
instruit et la *skill* fix terminent alors chaque *commit* qu'ils font par le *trailer*
`Agent: <host> ddd-ts-kit@<plugin version> <agent name>`, et le rapport compte les *commits*
faits par un agent face à ceux faits à la main. C'est désactivé par défaut : beaucoup d'équipes
refusent les lignes d'attribution dans les *commits*, et la séparation qu'un audit veut
vraiment passe par l'identité de l'exécution (son propre compte, son propre jeton), qu'un
*trailer* ne fait qu'approcher.

Une fois la *pull request* ouverte, la revue et les vérifications de la plateforme répondent.
Quand le responsable du projet le demande, `/ddd-ts-kit:pull-request <number>`, lancée depuis
le *worktree* de la *story*, mène la *pull request* au vert : elle balaie les commentaires de
revue non résolus et les vérifications en échec, traite chacun sous les règles de la *story*
(un changement que la revue de conception n'avait pas prévu devient une décision `D<n>`, une
demande d'affaiblir une vérification passe par la *skill* `deviation`, une vérification en
échec est corrigée dans le code et jamais dans la vérification, pas de *force-push*), répond à
chaque fil, pousse, attend les vérifications et recommence jusqu'à ce que la *pull request*
n'attende plus que le responsable du code ; puis elle rend compte de ce qui a changé et de ce
qui a été refusé, et pourquoi.

## Plusieurs stories, plusieurs terminaux

`story-scope` refuse une *story* déjà ouverte dans un autre *worktree*, et coupe la branche de
celle que suit le tronc (`origin/main` pour `main`) : un `git fetch` suffit alors à voir le tronc
avancer. `npx ddd-ts-kit stories` dit, depuis n'importe quel *worktree*, où les *stories*
ouvertes se croisent pendant qu'on les construit : les contextes que nomment les lignes de deux
d'entre elles, les fichiers que changent les deux *worktrees* (*commités* ou non), ce que la
fusion de la branche de l'une dans l'autre laisserait à régler à la main et ce que
`merge-trunk` règle seul (calculé avec `git merge-tree`, rien n'est écrit), et le retard de
chaque *story* sur son tronc. La session le lit avant de découper ses lignes et avant chaque
ligne ; la garde le dit au démarrage de la session, et une fois par fichier quand la session
écrit un fichier qu'une autre *story* change. La session tient ses lignes à l'écart de ce
qu'une autre *story* change quand elle le peut, sinon elle consigne laquelle arrive la première.
Chaque branche fusionne le tronc avant sa *pull request* avec
`npx ddd-ts-kit merge-trunk --trunk <base>` : les fichiers partagés par construction (documents
générés, registres, migrations, `slices.md`) se fusionnent comme le dit le
[travail en parallèle](parallel-work.fr.md), le reste revient à la session ; la seconde *story*
à arriver règle le conflit que les deux partagent. Les *pull requests* fusionnent l'une après
l'autre, chacune sur un tronc vert.

## Ce qui tient l'ordre

| Quoi | Tenu par |
|---|---|
| aucun code d'un contexte avant que chaque ligne soit conçue et l'acceptation écrite et verrouillée | la garde, dans le *worktree* d'une *story* (`story --gate build`, relu à chaque changement de ses entrées) |
| un scénario verrouillé changé alors que son critère ne l'est pas, ou un critère changé | `ddd-ts-kit acceptance` et `--lock`, jusqu'à un verdict de l'agent `acceptance-judge` ; la garde, qui ne laisse que le juge écrire un verdict |
| un agent hors de son contexte | la garde, d'après `.ddd-ts-kit/worker.json` |
| la même *story* dans deux sessions | `story-scope` |
| deux *stories* qui changent le même fichier | `stories` ; la garde, au démarrage de la session et à la première écriture d'un tel fichier |
| une session qui finit avant son rapport | la garde, qui refuse le premier arrêt de chaque étape |
| la *pull request* : chaque ligne faite, aucun scénario en attente, le tronc fusionné, l'origine consignée, le rapport écrit avec sa vérification | `story --gate close` |

## Hôtes

Claude Code exécute tout le parcours : la *skill*, les agents et la garde. Codex et Copilot
exécutent la *skill* et la garde ; sans les agents du plugin, la session construit chaque ligne
elle-même avec la *skill* `use-case`, rien ne la confine à un contexte sinon la consigne et la
revue, et la vérification par un contexte neuf est sautée, ce que dit le rapport.

## Limites

- La session demande une fois. Une réponse qui se révèle fausse revient par le rapport et la revue
  de la *pull request*, pas au milieu de la *story*.
- Le juge est un agent, pas le responsable du projet : son verdict est une seconde lecture avant le
  verrou, et le responsable valide chaque amendement à la revue de la *pull request*.
- Deux *stories* sur le même agrégat dans deux terminaux entrent encore en conflit à la fusion de
  la seconde : `stories` et la garde le disent dès que les deux changent un fichier, ils ne
  l'empêchent pas.
- Le tronc est lu tel que le dernier `git fetch` l'a laissé : ni la garde ni la CLI ne vont sur
  le réseau. La *skill* fait un `fetch` avant chaque ligne et avant de clore ; la garde dit quand
  le dernier `fetch` date de plus d'une heure.

## Voir aussi

- [Méthodologie](methodology.fr.md), [travail en parallèle](parallel-work.fr.md), [discipline des commits](commit-discipline.fr.md)
- [Quelle commande, quand](commands.fr.md), [le plugin pour agents de code](coding-agents.fr.md)
