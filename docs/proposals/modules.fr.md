[English](modules.md) · **Français**
<!-- translation-of: modules.md sha256:beffa487fe08f0a5 -->

# Proposition : des modules à l'intérieur d'un contexte délimité

Cette page répond à deux problèmes rencontrés en construisant avec le kit, dit ce que le
Domain-Driven Design propose pour eux selon ses publications de référence, juge ce que les
modules apportent et coûtent, et consigne ce que le kit a construit. Elle se termine par l'essai
qui a mesuré le coût sur l'application d'exemple, gardé pour l'historique.

## État (2026-10-22)

**Construit.** La référence est désormais la page de concept
[Modules du modèle](../concepts/modules.fr.md), avec les deux guides
[Un gestionnaire aux nombreuses dépendances](../guides/many-dependencies.fr.md) et
[Un cycle entre deux contextes](../guides/cycle-between-contexts.fr.md). Cette page garde le
raisonnement, le jugement et l'essai.

| Partie | Verdict |
|---|---|
| Des modules à l'intérieur d'un contexte (Evans) | **construit** |
| Guide : un gestionnaire (handler) qui a beaucoup de dépendances | **écrit**, sans règle |
| Guide : un cycle entre deux contextes | **écrit**, sans règle |
| Une vérification de l'agent `architecture-reviewer` | **ajoutée** |
| Sous-contextes, contextes enfants, contextes délimités imbriqués | **non** : ce n'est pas un concept des références |
| Couches de responsabilité entre contextes | **non** |
| Une limite au nombre de dépendances d'un constructeur | **non** |
| Un rôle `application/services/` | **non** |
| Un arbre de sous-domaines séparé des contextes | **non** : un module porte son sous-domaine |

## Les deux problèmes

1. **Un gestionnaire dont le constructeur prend trop de dépendances.** Il lit plusieurs ports,
   écrit dans plusieurs *repositories*, appelle plusieurs *gateways*.
2. **Deux contextes qui ont besoin l'un de l'autre.** `context/no-cycle` refuse le cycle, alors
   on fusionne les deux, et le contexte fusionné dépasse ce qu'une personne ou un agent peut
   tenir en tête.

Les deux posent la même question : un contexte peut-il avoir des sous-contextes, ou des
enfants ?

## Ce que disent les références

Chaque citation ci-dessous a été lue dans le texte d'Eric Evans, *Domain-Driven Design
Reference* (2015), le résumé des *patterns* du livre de 2003 et de ceux ajoutés depuis. Les
citations restent en anglais.

| *Pattern* | Ce que dit le texte | Ce que cela donne ici |
|---|---|---|
| Bounded Context | "Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas." | Un contexte est un modèle aux frontières explicites. Le texte ne les imbrique jamais ; la référence n'a ni entrée ni mention d'un sous-contexte. |
| Modules | "Choose modules that tell the story of the system and contain a cohesive set of concepts. Give the modules names that become part of the ubiquitous language. Modules are part of the model." | La division *à l'intérieur* d'un modèle. |
| Modules | "This often yields low coupling between modules, but if it doesn't look for a way to change the model to disentangle the concepts, or an overlooked concept that might be the basis of a module." | Le couplage entre modules est un signal sur le modèle, pas une mesure à respecter. |
| Generic Subdomains | "Factor out generic models of these subdomains and place them in separate modules." | Un sous-domaine peut vivre dans un module d'un contexte, pas seulement dans un contexte à lui. |
| Abstract Core | "Place this abstract overall model in its own module, while the specialized, detailed implementation classes are left in their own modules defined by subdomain." | Des modules définis par sous-domaine, et un module pour ce qu'ils partagent. |
| Segregated Core | "Factor all generic or supporting elements into other objects and place them into other packages." | Le cœur d'un grand modèle est rendu visible par des modules. |
| Services | "Give the service a name, which also becomes part of the ubiquitous language." | Un regroupement de comportement est un concept nommé, pas un sac. |
| Domain Events | "We keep the aggregates internally consistent at all times, while making other changes asynchronously." | Les effets qui suivent une décision partent sous forme d'événements. |
| Partnership | "Institute a process for coordinated planning of development and joint management of integration." | Evans admet deux contextes qui dépendent l'un de l'autre, entre équipes. Refuser le cycle dans le code est un choix de ce kit (chaque contexte reste extractible), pas une règle du Domain-Driven Design. |
| Responsibility Layers | "Refactor the model so that the responsibilities of each domain object, aggregate, and module fit neatly within the responsibility of one layer." | Les couches organisent un modèle. Les étendre aux contextes serait une extrapolation. |
| Evolving Order | "It is best not to shoot for comprehensiveness, but rather to find a minimal set that solves the problems that have emerged. Less is more." | La raison de construire peu. |

Pour le gestionnaire qui a beaucoup de dépendances, Mark Seemann parle de *constructor
over-injection* et le traite comme une odeur, pas comme une règle : "This is only guidance", et
"There could be cases where it's genuinely valid to have dozens of dependencies". Le remède
habituel, la refactorisation vers des *Facade Services*, s'applique quand les arguments "fall in
two or more natural clusters" ; les préoccupations transverses sont "better addressed with
Decorators or the Chain of Responsibility pattern" ; la cause de fond est en général une
violation du principe de responsabilité unique.

La réponse à la question est donc : **un sous-domaine, oui ; un sous-contexte, non ; ce qu'on
cherche est un module.** Une partie d'un modèle qui a son propre langage est un contexte. Une
partie d'un seul modèle, avec le même langage, le même schéma et la même cohérence, trop grande
pour se lire d'un seul tenant, est un module.

## Jugement

**Ce que les modules apportent.**

- **Lire par concept d'abord.** Un dossier de module tient une partie du modèle, les « modules
  that tell the story of the system » (Evans, Modules), au lieu de la répartir dans les dossiers
  de rôle de tout le contexte.
- **Une étape entre un grand contexte et deux contextes liés par un cycle indésirable.** Même
  langage, même schéma, même transaction : pas d'événement d'intégration, pas d'*outbox*, pas de
  cohérence à terme.
- **Une unité plus petite à charger**, pour une personne ou un agent de code.
- **Le couplage rendu visible.** `module/no-cycle` avertit là où le modèle s'emmêle, le signal
  qu'Evans nomme.

**Ce qu'ils ne font pas, dit franchement.**

- Un module ne réduit pas les dépendances d'un gestionnaire : c'est le guide de la partie 2.
- Un module ne garantit rien, à lui seul, de la lisibilité. Une découpe par technique
  (`shared`, `core`) dégrade un contexte, c'est pourquoi `module/declared` demande des termes du
  langage et refuse les mots techniques. Que la découpe suive le modèle reste un jugement des
  personnes.
- Un niveau de dossier de plus et des imports plus longs.
- `infrastructure/` et `presentation/` restent organisés par technique, si bien que les fichiers
  d'un module sont à deux endroits.
- Le mot « module » nomme aussi `<context>.module.ts` et `ContextModule` ; les pages disent
  « module du modèle » là où les deux pourraient être confondus.

**Quand.** Quand un contexte tient deux groupes de concepts ou plus du même langage qu'un lecteur
ouvre séparément. Jamais pour cacher un second langage : c'est alors un contexte (question 1 du
guide de la partie 3).

**L'expérience du développeur.** Chaque étape a sa commande et chaque refus nomme la suivante :
`generate module` déclare un module et le documente, `move-to-module` déplace l'existant avec ses
imports, `generate --module` écrit dedans, `module/complete` avertit (sans jamais bloquer) tant
qu'un contexte n'est pas déplacé, et un contexte sans modules ne voit aucun changement.

## Ce qui est construit

### 1. Des modules à l'intérieur d'un contexte

Un module est facultatif. Un contexte qui n'en déclare aucun ne voit aucun changement.

**Configuration.** Un contexte liste ses modules ; chacun peut porter la classification du
sous-domaine qu'il contient.

```json
{
  "contexts": {
    "scheduling": {
      "classification": "core",
      "upstreams": [],
      "modules": { "calendars": { "classification": "supporting" }, "waitlist": {} }
    }
  }
}
```

**Arborescence.** Un module est un niveau de dossier juste sous `domain/` et `application/` ;
en dessous, les dossiers de rôle de la section 2 d'ARCHITECTURE.md, inchangés.

```
contexts/scheduling/
  domain/
    errors/codes.ts                       la liste des codes reste une par contexte
    calendars/
      aggregates/calendar.aggregate.ts
      value-objects/opening-hours.vo.ts
      errors/unknown-calendar.error.ts
    waitlist/
      aggregates/waitlist.aggregate.ts
  application/
    authorization/scheduling.permissions.ts   le jeu de permissions reste un par contexte
    calendars/
      commands/set-opening-hours/set-opening-hours.handler.ts
      commands/commands.declarations.ts     généré, par dossier de rôle du module
    waitlist/
      commands/join-waitlist/join-waitlist.handler.ts
  infrastructure/ presentation/ test/       inchangés : rangés par technique, pas par modèle
```

Le concept vient d'abord et la sorte de fichier ensuite, parce qu'un module fait partie du
modèle. `infrastructure/` et `presentation/` gardent leur disposition : elles sont rangées par
technique et regroupent déjà une route ou un adaptateur par cas d'usage.

**Reconnaissance.** Le vérificateur et le plugin ESLint lisent un dossier placé juste sous
`domain/` ou `application/` comme un module quand la configuration le déclare ; un dossier non
déclaré reste signalé par `tree/closed`, dont le correctif nomme `generate module`, si bien qu'un
dossier de rôle mal orthographié (`domain/aggregate/`) est signalé, pas pris pour un module.
`discoverContext` de `@ddd-ts-kit/di`, qui tourne sans la configuration, reconnaît un module à sa
structure : tout dossier placé juste sous `application/` qui n'est pas un dossier de rôle.

**Ce qui reste au niveau du contexte.** `domain/errors/codes.ts` (la liste fermée des codes du
contexte), `application/authorization/<context>.permissions.ts` (son jeu de permissions), le
`<context>.declarations.ts` généré, `CONTEXT.md`, `published-language/`.

**Ce qu'un module n'a jamais.** Un glossaire à lui, un schéma de base de données à lui, un
`published-language/` à lui, des événements d'intégration échangés avec un autre module du même
contexte, un fichier de module (câblage) à lui. Une partie qui a besoin de l'un d'eux est un
contexte.

**Règles.**

| Règle | Ce qu'elle tient | Sévérité |
|---|---|---|
| `tree/closed` (modifiée) | accepte le niveau d'un module déclaré ; refuse toujours un module non déclaré | comme aujourd'hui |
| `module/declared` | chaque module de `contexts.<name>.modules` est nommé avec des termes du langage omniprésent de son contexte (chaque mot de son nom ; les mots techniques comme `shared`, `common`, `utils`, `core` sont refusés), et a une ligne dans la section `## Modules` de `CONTEXT.md` qui donne son but | `error` |
| `module/complete` | dès qu'un contexte déclare des modules, un fichier de `domain/` ou `application/` hors de tout module, fichiers du niveau du contexte mis à part, est signalé. Un avertissement, pour qu'un contexte passe en modules un *commit* à la fois | `warn` |
| `module/no-cycle` | les imports entre les modules d'un contexte ne forment pas de cycle. Un avertissement, parce qu'Evans fait du couplage entre modules un signal pour changer le modèle ("look for a way to change the model to disentangle the concepts"), pas un refus | `warn` |

**Générateur.** `generate module <context> <module> [--purpose] [--classification] [--term]...`
déclare un module : la configuration, sa ligne de `## Modules`, les termes du glossaire ; il peut
être relancé et ajoute ce qui manque. `generate <kind> <context> ... --module <module>` écrit les
fichiers de `domain/` et `application/` dans le module, trouve les fichiers qu'il lit dans le
module qui les tient, et écrit des imports qui les nomment là où ils sont. Dans un contexte qui
déclare des modules, une sorte qui écrirait un fichier de `domain/` ou `application/` sans
`--module` est refusée, avec la liste des modules et la même commande avec `--module`.

**Déplacer l'existant.** `move-to-module <context> <module> <path>... [--dry-run]` déplace des
fichiers et des dossiers de `domain/` et `application/` dans un module déclaré et réécrit chacun
de leurs imports sous la racine des sources, `test/` et `scripts/`, et réécrit les déclarations
générées dans le même passage ; viennent ensuite les vérifications.

**Documentation générée.** `ddd-ts-kit docs` et `describe` lisent les dossiers de rôle de chaque
module, et une *spec* échoue quand un fichier de rôle d'un module manque à `describe`.

### 2. Guide : un gestionnaire qui a beaucoup de dépendances

Pas de règle : Seemann ne donne aucun nombre, et une règle inviterait à créer des façades pour
la faire taire. Le guide est un ordre de diagnostic où chaque remède a déjà sa place dans
l'arborescence.

| Ce que font les dépendances | Remède | Où |
|---|---|---|
| Journalisation, cache, droits, nouvelles tentatives | un décorateur ou une chaîne de responsabilité (Seemann) | les *middlewares* des bus |
| Effets qui suivent la décision | un événement du domaine et son gestionnaire (Evans, Domain Events) | `application/event-handlers/` |
| Lectures d'un autre contexte | une projection locale alimentée par ses événements (Evans, Domain Events) | `application/projections/` |
| Étapes réparties dans le temps | un gestionnaire de processus (Hohpe et Woolf, *Enterprise Integration Patterns*, 2003) | `application/processes/` |
| Lectures qui forment ensemble un concept | un port nommé dans le langage omniprésent, dont l'adaptateur compose les sources (Seemann, *Facade Service*) | `application/ports/` |
| Une décision sur plusieurs agrégats | un service du domaine, sans état et sans entrée-sortie (Evans, Services) | `domain/services/` |
| Encore trop | le gestionnaire fait deux choses : découper le cas d'usage (responsabilité unique) | deux cas d'usage |

Pas de rôle `application/services/` : les six emplacements ci-dessus couvrent chaque cas, et un
service applicatif partagé tend à devenir l'endroit où va tout le reste.

### 3. Guide : un cycle entre deux contextes

Trois questions, dans cet ordre.

1. **Un seul langage, un seul modèle ?** Alors c'est un seul contexte, divisé en modules
   (Generic Subdomains, Abstract Core).
2. **Sinon, une direction peut-elle devenir un événement ?** L'amont publie, l'aval réagit
   (Domain Events).
3. **Sinon, manque-t-il un concept ?** Le concept négligé du *pattern* Modules, souvent un
   troisième contexte qui possède ce que les deux se disputaient.

La page de concept de la carte des contextes dit que refuser le cycle est un choix du kit, et que
Partnership est une relation entre équipes.

### 4. Une vérification de l'agent architecture-reviewer

Pour un constructeur qui a beaucoup de dépendances, le *reviewer* parcourt le tableau du guide
et nomme le remède qui s'applique. Il ne compte jamais.

## Ce qui n'est pas construit, et pourquoi

| Pas construit | Pourquoi |
|---|---|
| Sous-contextes, contextes enfants | Pas un concept des références. Une partie qui a son propre langage est un contexte ; une partie d'un seul modèle est un module. |
| Couches de responsabilité entre contextes | Evans les applique à l'intérieur d'un modèle ; Evolving Order demande la structure minimale qui résout le problème rencontré. `context/no-cycle` garde déjà les contextes sans cycle. |
| Une limite aux dépendances d'un constructeur | Seemann : "only guidance". Un nombre serait atteint par de fausses façades. |
| `application/services/` | Chaque cas a déjà sa place ; un service partagé attire tout le reste. |
| Un arbre de sous-domaines séparé | Evans place un sous-domaine dans un module ; le module porte la classification. |
| Une relation `partnership` dans la configuration | La configuration est orientée et le kit refuse les cycles à dessein. |
| Des modules dans `infrastructure/` et `presentation/` | Rangées par technique ; un module fait partie du modèle. |

## Essai : ce que cela coûtait (historique)

L'essai a tourné avant la construction, sur une branche. Chaque manque qu'il a trouvé est
désormais couvert : `docs` et `describe` lisent les modules et une *spec* le garde,
`serialize-config` garde `modules`, `discoverContext` reconnaît un module à sa structure, et le
générateur écrit dans les modules.

**Ce qui a été fait.** Dans l'application d'exemple, le contexte `scheduling` a été divisé en
deux modules tirés de son glossaire : `calendars` (calendrier, horaires d'ouverture, exceptions,
absences, types de rendez-vous) et `waitlist` (liste d'attente, personne en attente, offre).
66 fichiers déplacés (53 et 13), 135 fichiers ont eu leurs imports réécrits, les rendez-vous sont
restés où ils étaient. Les outils ont appris le niveau du module dans 14 fichiers, 107 lignes
ajoutées et 8 retirées : `locate` du *checker* et du plugin ESLint laissent le module hors du
chemin qu'ils classent, `tree/closed` accepte un module déclaré, et les déclarations générées
ont un fichier par dossier de rôle d'un module.

**Résultats sur l'exemple.**

| Exécution | Avant | Avec des modules |
|---|---|---|
| `tsc --noEmit` | passe | passe |
| `ddd-ts-kit check` | 0 erreur | 0 erreur, après que `ddd-ts-kit docs` a réécrit les déclarations (9 erreurs avant : `tree/closed` 4, `declarations/barrel-current` 5) |
| `ddd-ts-kit docs --check` | passe | passe, **mais voir la perte plus bas** |
| ESLint sur le contexte | passe | passe |
| *specs* unitaires et d'architecture du contexte | passent | 153 fichiers, 707 tests passent, `every-class-resolves` compris : le conteneur résout les classes des modules |
| dependency-cruiser, knip | passent | passent |
| *specs* du kit (`packages/cli`, `packages/eslint-plugin`, `packages/di`), avec le prototype | | 4935 passent, aucun n'échoue (818 ignorés, 27 fichiers) : un projet sans modules ne voit aucun changement |

**Les règles voient-elles encore les fichiers d'un module ?** Les mêmes fautes ont été écrites
deux fois, une fois dans un module et une fois en dehors : un agrégat avec une propriété publique
modifiable, un nom hors du glossaire et sans *spec* ; un service du domaine qui importe un
adaptateur, lit l'horloge du système et lève une erreur générique. Chaque règle a signalé les
deux copies de la même façon : `language/glossary-term`, `layer/domain-purity`,
`purity/no-system-clock`, `test/spec-required` et `test/builder-required` du *checker* ;
`domain-aggregate-encapsulation`, `domain-no-generic-error`, `layer-domain-purity`,
`naming-business-name` et `purity-no-system-clock` du plugin ESLint.

**Ce que l'essai a trouvé.**

- **Une perte silencieuse dans la documentation générée.** `docs` et `describe` listent chaque
  dossier de rôle à plat (`ws.list('domain/errors')`), dans une quinzaine de lecteurs. Ils ont
  perdu, sans aucune erreur, les agrégats `Calendar` et `Waitlist`, deux *repositories*, un *job*
  d'arrière-plan, le publieur de `scheduling.calendar.created` et treize refus de la référence de
  `CONTEXT.md`, et `docs --check` est passé parce qu'il compare avec la même lecture aveugle.
  C'est le coût principal et le risque principal : les lecteurs ont besoin d'une seule fonction
  qui liste les dossiers de rôle d'un contexte, et d'une *spec* qui échoue quand un fichier de
  rôle manque dans `describe`.
- `serialize-config` perdrait `modules` quand le générateur réécrit la configuration.
- `discoverContext` de `@ddd-ts-kit/di` (l'assemblage par découverte) refuse un fichier de rôle
  hors de son dossier canonique ; il lui faut la même reconnaissance par la structure. L'exemple
  assemble par *barrel* et ne l'a pas exercé.
- Le générateur n'a pas été touché : une quarantaine d'endroits de `generate/kinds/` calculent un
  chemin cible.

**Estimation de l'époque, en trois *pull requests***, chacune avec sa documentation :

1. **Reconnaissance** (aucun changement pour un contexte sans modules) : le niveau du module dans
   `locate`, `tree/closed`, les déclarations, les lecteurs de `docs` et `describe`,
   `discoverContext`, la configuration (lecture, écriture, `config/valid`), et l'arborescence de
   la section 2 d'ARCHITECTURE.md et CONFIG.md. Moyenne : l'essai en couvre la moitié ; les
   lecteurs sont le reste.
2. **Règles et générateur** : `module/declared`, `module/complete`, `module/no-cycle` avec leurs
   entrées `explain` et leurs *fixtures*, `--module` sur `generate`. Moyenne.
3. **Enseignement** : la page de concept `docs/concepts/modules.md`, les deux guides, les pages
   sur le contexte délimité, les sous-domaines et la carte des contextes, les *skills*
   `bounded-contexts`, `context-map`, `scaffold`, `use-case` et `wiring`, la vérification
   d'`architecture-reviewer`. C'est là qu'on décide si l'exemple adopte les deux modules de
   l'essai.

## Encore à vérifier

- Seemann et van Deursen, *Dependency Injection Principles, Practices, and Patterns* (Manning,
  2019), chapitre 6 : s'il cite les événements du domaine comme remède à l'*over-injection*.
  L'article du blog ne le fait pas ; en attendant, le guide cite Evans pour les événements du
  domaine.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), chapitre 9 : ses règles sur les
  dépendances entre modules voisins. Tant qu'il n'est pas lu, `module/no-cycle` repose sur Evans
  seul.
- Le mot « module » nomme déjà `<context>.module.ts` (le câblage explicite) et `ContextModule`
  de `@ddd-ts-kit/di`. Le kit garde le mot d'Evans ; chaque page qui l'emploie dit « module du
  modèle » là où les deux pourraient se confondre.

## Sources

- Eric Evans, *Domain-Driven Design Reference: Definitions and Pattern Summaries*, Domain
  Language, 2015, domainlanguage.com/ddd/reference : Bounded Context, Modules, Services, Domain
  Events, Partnership, Generic Subdomains, Cohesive Mechanisms, Segregated Core, Abstract Core,
  Evolving Order, Responsibility Layers.
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software*,
  Addison-Wesley, 2003, chapitres 5 (Modules), 14 (Maintaining Model Integrity), 15
  (Distillation) et 16 (Large-Scale Structure).
- Mark Seemann, « On Constructor Over-injection », 2018, blog.ploeh.dk ; « Refactoring to
  Aggregate Services », 2010, blog.ploeh.dk.
- Gregor Hohpe et Bobby Woolf, *Enterprise Integration Patterns*, Addison-Wesley, 2003
  (Process Manager).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitres 2 et 9.
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapitre 1 (distilling
  subdomains) et chapitre 3 (bounded contexts versus subdomains).

## Voir aussi

- [Modules du modèle](../concepts/modules.fr.md)
- [Un gestionnaire aux nombreuses dépendances](../guides/many-dependencies.fr.md)
- [Un cycle entre deux contextes](../guides/cycle-between-contexts.fr.md)
- [Contexte délimité](../concepts/bounded-context.fr.md)
- [Domaine et sous-domaines](../concepts/domain-and-subdomains.fr.md)
- [Carte des contextes](../concepts/context-map.fr.md)
- [Sagas et gestionnaires de processus](../concepts/sagas-and-process-managers.fr.md)
- [Ports et composition](../concepts/ports-and-composition.fr.md)
- [Référence de l'architecture](../ARCHITECTURE.fr.md)
