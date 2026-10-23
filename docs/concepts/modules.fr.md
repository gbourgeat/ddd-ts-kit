[English](modules.md) · **Français**
<!-- translation-of: modules.md sha256:160f75a4ea096eaa -->

# Modules du modèle

**Résumé.** Un module divise un modèle en parties qu'un lecteur ouvre séparément. Ce n'est pas un
sous-contexte : une partie dotée de son propre langage est un [contexte délimité](bounded-context.fr.md) ;
une partie d'un seul modèle, avec le même langage, le même schéma de base de données et les mêmes
transactions, est un module (Evans, *Domain-Driven Design Reference*, « Modules »). Dans ce kit,
un module est facultatif : un dossier placé directement sous `domain/` et `application/` d'un
contexte, déclaré dans la configuration, nommé avec des termes du glossaire, avec les dossiers de
rôle inchangés en dessous. Trois règles le gardent honnête (`module/declared`, `module/complete`,
`module/no-cycle`), `generate --module` écrit dedans, et `move-to-module` fait passer un contexte
existant en modules, un commit à la fois.

## Un module, pas un sous-contexte

Un contexte grandit. Soit son glossaire se scinde en deux vocabulaires, et ce sont deux
contextes ; soit le langage reste un seul et le modèle est simplement grand. Le second cas a un
nom dans les références, et ce n'est pas « sous-contexte » : aucune publication de référence
n'emboîte des contextes délimités.

| Patron (Evans, *DDD Reference*, 2015) | Ce que dit le texte | Ce qu'il donne ici |
|---|---|---|
| Modules | « Choose modules that tell the story of the system and contain a cohesive set of concepts. Give the modules names that become part of the ubiquitous language. Modules are part of the model. » | la division à l'intérieur d'un seul modèle, nommée dans son langage |
| Modules | « This often yields low coupling between modules, but if it doesn't look for a way to change the model to disentangle the concepts, or an overlooked concept that might be the basis of a module. » | le couplage entre modules est un signal sur le modèle, pas une mesure à respecter |
| Generic Subdomains | « Factor out generic models of these subdomains and place them in separate modules. » | un [sous-domaine](domain-and-subdomains.fr.md) peut vivre dans un module d'un contexte |
| Abstract Core | « Place this abstract overall model in its own module, while the specialized, detailed implementation classes are left in their own modules defined by subdomain. » | des modules définis par sous-domaine |
| Evolving Order | « It is best not to shoot for comprehensiveness, but rather to find a minimal set that solves the problems that have emerged. Less is more. » | la raison pour laquelle les modules sont facultatifs et s'arrêtent à un niveau |

Un module répond donc à « ce contexte est trop grand pour être lu », jamais à « ces deux parties
parlent des langages différents ». Deux parties qui ont besoin l'une de l'autre mais parlent un
seul langage sont un contexte divisé en modules ; deux parties avec deux langages sont deux
contextes, et le guide [Un cycle entre deux contextes](../guides/cycle-between-contexts.fr.md) dit
comment rompre leur cycle.

## Ce qu'il apporte, et ce qu'il n'apporte pas

**Les gains.**

- **Lire par concept d'abord.** Un dossier tient une partie du modèle : tout ce qui concerne la
  liste d'attente est sous `domain/waitlist/` et `application/waitlist/`, et non réparti dans dix
  dossiers de rôle partagés avec tout le reste. Ce sont les « modules that tell the story of the
  system ».
- **Une étape entre un grand contexte et deux contextes.** Avant les modules, un contexte trop
  grand pour être tenu en tête avait deux issues : rester grand, ou se scinder en deux contextes
  et payer des événements d'intégration, une *outbox*, la cohérence à terme et, quand ils ont
  besoin l'un de l'autre, un cycle refusé. Un module garde le langage, le schéma et la
  transaction, et coûte un dossier.
- **Une unité plus petite à charger.** Une personne ou un agent de code qui travaille sur la
  liste d'attente lit un module et les fichiers du niveau du contexte, pas le contexte entier.
- **Le couplage rendu visible.** `module/no-cycle` avertit quand deux modules s'importent
  mutuellement : le signal qu'Evans nomme pour chercher un meilleur modèle ou un concept manquant.

**Les limites, dites franchement.**

- **Un module ne réduit pas les dépendances d'un gestionnaire.** Un gestionnaire (handler) dont
  le constructeur prend trop de ports les a quel que soit son dossier : voir
  [Un gestionnaire aux nombreuses dépendances](../guides/many-dependencies.fr.md).
- **Un module ne garantit rien, à lui seul, de la lisibilité.** Une découpe par technique
  (`shared`, `core`, `common`) rend un contexte plus difficile à lire, pas plus facile. C'est
  pourquoi `module/declared` demande des termes du glossaire et refuse les mots techniques ; que
  la découpe suive le modèle reste un jugement des personnes, revu par l'agent
  `architecture-reviewer`.
- **Un niveau de dossier de plus**, et des imports plus longs.
- **`infrastructure/` et `presentation/` restent organisés par technique.** Un module fait partie
  du modèle ; un adaptateur ou une route se regroupe déjà par cas d'usage. Les fichiers d'un
  module sont donc à deux endroits : ses dossiers de `domain/` et `application/`, et les
  adaptateurs et les routes de ses cas d'usage.
- **« Module » nomme déjà deux choses du kit** : `<context>.module.ts` (câblage explicite) et
  `ContextModule` de `@ddd-ts-kit/di`. Les pages disent « module du modèle » partout où les deux
  pourraient être confondus.

## Quand diviser un contexte, et quand ne pas le faire

Divisez un contexte en modules quand il tient deux groupes de concepts ou plus du **même**
langage qu'un lecteur ouvre séparément : le glossaire est une seule table, mais ses termes se
rassemblent en groupes qui se rencontrent rarement dans un même cas d'usage.

Ne le divisez pas :

- **pour cacher un second langage.** Si un mot change de sens entre les deux parties, ce sont
  deux contextes ([Contexte délimité](bounded-context.fr.md), le test du langage).
- **pour faire disparaître un cycle entre contextes sans en chercher la raison.** Fusionner deux
  contextes en un seul à deux modules n'est juste que s'ils partagent un même langage ; sinon, un
  sens devient un événement, ou un concept manque.
- **tant que le contexte est petit.** Evolving Order : construire la structure qui résout un
  problème rencontré, pas celle qui pourrait servir.

## Dans ce kit

### L'arborescence

Un module est un niveau de dossier placé directement sous `domain/` et `application/` ; en
dessous, les dossiers de rôle de [l'arborescence canonique](../ARCHITECTURE.fr.md#2-arborescence-canonique),
inchangés.

```
src/contexts/appointments/
  CONTEXT.md                                   un seul glossaire, avec une section ## Modules
  appointments.declarations.ts                 généré, à la racine comme avant
  published-language/                          un par contexte
  domain/
    errors/codes.ts                            la liste fermée des codes du contexte
    booking/
      aggregates/appointment.aggregate.ts
      errors/slot-taken.error.ts
    waitlist/
      aggregates/waitlist.aggregate.ts
      value-objects/offer.vo.ts
  application/
    authorization/appointments.permissions.ts  l'ensemble des permissions du contexte
    booking/
      commands/book-appointment/...
      application.declarations.ts              généré, par couche du module
    waitlist/
      commands/join-waitlist/...
      event-handlers/offer-freed-slot.event-handler.ts
  infrastructure/  presentation/  test/        inchangés : organisés par technique
```

Ce qui ne passe jamais dans un module : `domain/errors/codes.ts`,
`application/authorization/<context>.permissions.ts`, `<context>.module.ts`, les fichiers générés
`<context>.declarations.ts` et `<context>.dependencies.ts`, `CONTEXT.md` et
`published-language/`. Un module n'a jamais de glossaire, de schéma de base de données, de langage
publié ni de fichier de module à lui, et deux modules d'un même contexte n'échangent jamais
d'événements d'intégration : une partie qui a besoin de l'un d'eux est un contexte.

### La configuration et CONTEXT.md

```json
"appointments": {
  "classification": "core",
  "upstreams": [{ "context": "calendars", "relationship": "published-language" }],
  "modules": { "booking": {}, "waitlist": { "classification": "supporting" } }
}
```

Un module peut porter la classification du sous-domaine qu'il tient (Generic Subdomains, Abstract
Core) ; sans elle, il a la classification de son contexte ([CONFIG.md](../CONFIG.fr.md#contextes)).
`CONTEXT.md` gagne une section `## Modules`, après `## Ubiquitous language`, avec une ligne par
module :

```md
## Modules

| Module | Purpose |
|---|---|
| `booking` | Booking, rescheduling and cancelling an appointment, and the rules that keep a slot held once. |
| `waitlist` | Clients waiting for a taken slot, and the offer made to the first of them when it frees up. |
```

### Les règles

| Règle | Tient | Sévérité |
|---|---|---|
| `tree/closed` | accepte le dossier d'un module déclaré, et signale toujours celui que la configuration ne déclare pas ; son correctif nomme `generate module` | `error` |
| `module/declared` | chaque module de `contexts.<name>.modules` est nommé avec des termes du glossaire de son contexte (chaque mot de son nom ; les mots techniques sont refusés (`shared`, `common`, `core`, `misc`, `utils` et les autres mots techniques de `language/no-technical-name`)) et a une ligne dans `## Modules` de `CONTEXT.md` | `error` |
| `module/complete` | dès qu'un contexte déclare des modules, un fichier de `domain/` ou `application/` hors de tout module, fichiers du niveau du contexte mis à part, est signalé | `warn`, pour qu'un contexte passe en modules un commit à la fois |
| `module/no-cycle` | les imports entre les modules d'un même contexte ne forment aucun cycle | `warn`, parce qu'Evans fait du couplage entre modules un signal pour changer le modèle, pas un refus |

Toute autre règle lit un fichier d'un module comme elle lit le même fichier hors module : le rôle
d'un fichier est son chemin, dossier du module retiré. `npx ddd-ts-kit explain module/no-cycle`
donne la raison et un exemple de chaque règle.

### Le générateur et la commande de déplacement

```bash
# Déclarer le module : configuration, ligne de ## Modules, termes du glossaire. Peut être relancé.
npx ddd-ts-kit generate module appointments waitlist \
  --purpose "Clients waiting for a taken slot, and the offer made to the first of them when it frees up." \
  --term "Waitlist=The clients waiting for a slot that is taken, in the order they asked"

# Écrire dedans : chaque fichier de domain/ et application/ va dans le module.
npx ddd-ts-kit generate aggregate appointments Waitlist --module waitlist
npx ddd-ts-kit generate command appointments JoinWaitlist --aggregate Waitlist --permission waitlist.join --module waitlist

# Déplacer l'existant, avec chacun de ses imports dans le projet.
npx ddd-ts-kit move-to-module appointments booking domain/aggregates/appointment.aggregate.ts application/commands/book-appointment
```

- Avec `--module`, les fichiers qu'un générateur lit (un agrégat existant, un événement, un port)
  sont trouvés dans le module qui les tient, et les imports qu'il écrit nomment leur emplacement.
  Un fichier d'un cas d'usage déjà dans un module est écrit avec lui, `--module` ou non ; un
  `--module` qui nomme un autre module est refusé, puisqu'il couperait le cas d'usage en deux.
  Les fichiers de niveau contexte (la liste des codes, le jeu de permissions) restent au niveau du
  contexte.
- Dans un contexte qui déclare des modules, un générateur qui écrirait un fichier de `domain/` ou
  `application/` sans `--module` est refusé, avec la liste des modules et la même commande avec
  `--module` : le générateur guide, il ne laisse jamais le choix implicite.
- `move-to-module` prend des chemins relatifs au contexte, des fichiers ou des dossiers sous
  `domain/` ou `application/`, les déplace dans un module déclaré et réécrit chacun de leurs
  imports sous la racine des sources, `test/` et `scripts/` ; les déclarations générées suivent
  dans le même passage. Un chemin déjà dans un module passe dans l'autre, et tous les fichiers
  d'un dossier sont déplacés, pas seulement ses sources. Rien n'est déplacé quand un fichier du
  même nom est déjà dans le module, quand deux fichiers atterriraient sur le même chemin, quand un
  autre module du contexte tient un fichier du même rôle et du même nom (les déclarations du
  contexte l'exporteraient deux fois), ou quand un fichier n'est pas du texte. `--dry-run` montre
  le plan ; viennent ensuite les vérifications et les tests.

### Ce qui lit les modules

- `ddd-ts-kit check` et le plugin ESLint lisent un dossier sous `domain/` ou `application/` comme
  un module quand la configuration le déclare.
- `ddd-ts-kit docs`, `describe`, `error-factories` et les générateurs lisent les dossiers de rôle
  de chaque module que la configuration déclare, comme `check` : la référence de `CONTEXT.md`
  liste les agrégats, cas d'usage, ports, refus et *jobs* des modules comme ceux du contexte. Un
  dossier que la configuration ne déclare pas n'est lu par aucun d'eux, et `tree/closed` le
  signale.
  `error-factories` écrit la classe d'un concept à côté des erreurs qu'elle remplace, dans leur
  module ; les erreurs d'un concept lues dans deux dossiers sont refusées tant que
  `move-to-module` ne les a pas rassemblées.
- Dans le style déclaré assemblé par barrel, chaque couche d'un module a son
  `<layer>.declarations.ts` généré, réexporté par `<context>.declarations.ts`.
- `discoverContext` de `@ddd-ts-kit/di` s'exécute sans la configuration : il lit les modules dans
  le `<context>.dependencies.ts` généré, que `ddd-ts-kit docs` écrit avec eux
  (`export const modules = [...]`). Un dossier que ce fichier ne nomme pas n'est pas un module au
  démarrage non plus : un fichier de rôle qui s'y trouve est refusé, comme `check` le signale.

## Adopter les modules, pas à pas

1. **Lisez le glossaire.** Groupez ses termes par les cas d'usage qui les emploient ensemble.
   Deux groupes qui se rencontrent rarement sont deux modules ; un mot à deux sens, ce sont deux
   contextes.
2. **Déclarez les modules** : `generate module <context> <module> --purpose "..."`, une fois par
   module. `module/complete` avertit alors pour chaque fichier hors module : cette liste est le
   plan.
3. **Déplacez un groupe par commit** : `move-to-module <context> <module> <paths>...`, puis
   `npm run verify`. Les tests ne bougent pas : `test/` reste organisé
   comme avant.
4. **Lisez les avertissements de `module/no-cycle`.** Un cycle entre deux modules demande si un
   concept est dans le mauvais module, ou si un concept manque.
5. **Dès lors, générez avec `--module`.**

## Limites et quand ne pas l'utiliser

- **Les outils vérifient les dossiers, pas la découpe.** `module/declared` prouve qu'un module est
  nommé dans le langage de son contexte ; il ne peut pas prouver que les concepts qu'il contient
  vont ensemble.
- **Aucune commande ne renomme ni ne retire un module.** Déplacez ses fichiers dans un autre
  module avec `move-to-module`, puis retirez à la main son entrée de `contexts.<name>.modules` et
  sa ligne de `## Modules`.
- **Un seul niveau.** Un module ne contient pas de module. Un module devenu trop grand pour être
  lu pose une question sur le contexte : deux contextes, ou un concept manquant.
- **Les règles `module/*` sont lues par `ddd-ts-kit check`.** Les imports entre modules sont lus
  au niveau du texte, comme le reste du vérificateur.
- **Un petit contexte n'a pas besoin de modules.** La plupart des contextes n'en auront jamais.

## Dans l'exemple

`examples/scheduling` divise son contexte en deux modules : `calendars` (les calendriers et les
rendez-vous qu'ils portent) et `waitlist`. Le diviser a montré à quoi sert `module/no-cycle` : le
calendrier construisait le waiter de la waitlist, et un handler des calendriers notait une
présence en même temps qu'il offrait un créneau libéré. Le calendrier répond maintenant le type
de rendez-vous qu'il propose et la waitlist construit son waiter ; la réaction qui offre un
créneau libéré appartient à la waitlist, celle qui note la présence aux calendriers.

## Sources

- Eric Evans, *Domain-Driven Design Reference: Definitions and Pattern Summaries*, Domain
  Language, 2015, domainlanguage.com/ddd/reference : Modules, Generic Subdomains, Abstract Core,
  Segregated Core, Evolving Order.
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software*,
  Addison-Wesley, 2003, chapitre 5 (Modules) et chapitre 15 (Distillation).
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapitre 3 (contextes délimités
  et sous-domaines).

## Voir aussi

- [Contexte délimité](bounded-context.fr.md)
- [Domaine et sous-domaines](domain-and-subdomains.fr.md)
- [Langage omniprésent](ubiquitous-language.fr.md)
- [Un gestionnaire aux nombreuses dépendances](../guides/many-dependencies.fr.md)
- [Un cycle entre deux contextes](../guides/cycle-between-contexts.fr.md)
- [Proposition : des modules à l'intérieur d'un contexte délimité](../proposals/modules.fr.md), avec l'essai
  qui en a mesuré le coût
- [Référence de l'architecture](../ARCHITECTURE.fr.md)
- [Index des concepts](README.fr.md)
