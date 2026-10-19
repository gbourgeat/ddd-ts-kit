[English](README.md) · **Français**
<!-- translation-of: README.md sha256:5c1237bc2e516383 -->

# Consignes des *workers*

Un fichier par *worker*, rempli à partir du `parallel-work/briefing-template.md` du kit. Ce qui suit
est commun à tous et propre à cet exemple : il n'y a pas de git ici, si bien que les *workers*
partagent un seul arbre au lieu d'avoir chacun un *worktree*, et l'exemple mesure l'outillage.

## Règles communes

- Projet : `/home/gbourgeat/ddd-ts-kit/examples/scheduling` (un *workspace* npm du dépôt du kit).
  Lancez chaque commande depuis là. Ne lancez jamais git, `npm install`, docker, ni quoi que ce soit
  qui écrive hors de votre périmètre. Ne modifiez jamais le kit lui-même
  (`/home/gbourgeat/ddd-ts-kit/packages`, `plugin`, `docs`, `pipeline`).
- D'autres *workers* écrivent dans le même arbre au même moment. Restez dans votre périmètre.
  L'arbre peut être rouge à cause du fichier inachevé de quelqu'un d'autre : ne regardez que les
  erreurs de vos propres fichiers, ne corrigez ni ne rétablissez jamais un fichier hors de votre
  périmètre, et relisez un fichier partagé juste avant de le modifier.
- Lisez d'abord, et seulement : les règles d'agent que `init` a générées à la racine du projet (le fichier d'instructions et son dossier `rules/`), le `CONTEXT.md` de
  votre contexte, vos lignes et vos règles dans `docs/architecture/slices.md` (avec son tableau
  « Permissions and the element they bear on »), puis `node scripts/kit.mjs list --json` une fois.
  Votre procédure, ce sont les *skills* du kit, à lire quand vous arrivez au sujet :
  `/home/gbourgeat/ddd-ts-kit/plugin/skills/` `use-case`, `scaffold` (avec `kinds.md`), `testing`,
  `persistence`, `integration-event`, `access-control`, `cross-cutting`. Détails d'API : le README
  du *package* concerné sous `/home/gbourgeat/ddd-ts-kit/packages/<name>/README.md` (cherchez-y, ne
  le lisez pas en entier).
- Créez chaque fichier d'un rôle généré avec le générateur, jamais à la main :
  `KIT_WORKER=<your name> node scripts/gen.mjs <kind> <args>` (il affiche les endroits `next` ;
  c'est `npx ddd-ts-kit generate <kind> <args> --json`, sérialisé et mesuré). Un nom dont le
  glossaire n'a pas les mots prend `--term "<Term>=<meaning>"`. Remplissez ensuite chaque
  `TODO(domain)` et remplacez chaque `it.todo` par un vrai test. Ne restructurez jamais le code
  généré, ne modifiez jamais `<context>.declarations.ts` (lancez `node scripts/kit.mjs docs` après
  avoir ajouté ou supprimé à la main un fichier de rôle). Quand un fichier généré est faux ou oblige
  à une correction à la main, faites la plus petite correction et notez-la pour votre rapport.
- Tests : *specs* du domaine sans doubles, *specs* de gestionnaires à travers les bus avec des
  *fakes*, *specs* d'adaptateurs sur le PostgreSQL en processus, aucun *mock*. Le temps par `Clock`,
  les identifiants par `IdGenerator`.
- Aucune désactivation, aucune sévérité abaissée, aucun `any`, aucune assertion de non-nullité (`!`), aucun
  test ignoré. L'anglais seulement. Jamais de caractère tiret cadratin ni demi-cadratin. Aucune
  mention de fournisseurs d'IA.
- Pendant l'itération : `npx eslint src/contexts/<context>`, `npx vitest run src/contexts/<context>`,
  `node scripts/kit.mjs check src/contexts/<context>`, `npm run typecheck` (tout le projet : ignorez
  les erreurs hors de vos fichiers). Ne lancez pas `npm run verify` : le chef d'orchestre le fait,
  sur tout l'arbre.
- Besoins hors de votre périmètre (la plateforme, la configuration, le contrat d'un autre contexte,
  un acteur système à relier, une liaison dans `src/platform/composition/platform.module.ts`) : ne les
  contournez pas, finissez ce qui n'en dépend pas et mettez-les dans votre rapport, assez précis
  pour être faits sans vous redemander. Le *worker* de la plateforme ajoute, en parallèle : un
  `RelationTupleStore` persistant (la classe de port de `@ddd-ts-kit/auth/rebac`, liée par la
  plateforme, en mémoire dans les *specs* de gestionnaires), le schéma des relations et
  l'autorisateur combiné décrits dans `slices.md`.

## Rapport (la dernière chose que vous écrivez, moins de 400 mots, sans code)

1. Tranches faites ; tranches non faites et pourquoi ; `TODO(domain)` ou `it.todo` restants (il ne
   doit y en avoir aucun).
2. Les commandes de générateur que vous avez lancées, comptées par type, et pour chaque type si
   sa sortie a compilé et passé les analyseurs sans retouche.
3. Chaque correction à la main de code généré (fichier, quoi, pourquoi) et chaque fichier que vous
   avez dû écrire à la main et qu'un générateur devrait plausiblement produire.
4. Les contradictions entre une *skill*, un README et le comportement de l'outil ; les violations
   de règles que vous avez rencontrées et si le message vous disait quoi faire ; ce qui a été
   agréable.
5. Quels fichiers vous avez dû ouvrir par tranche, à peu près (la lecture que l'outil vous a
   coûtée).
6. Besoins sur des fichiers partagés ou d'autres contextes ; termes ajoutés au glossaire ; questions
   métier ouvertes.
7. Résultats de vos derniers lancements d'eslint, de vitest, de check et de typecheck (erreurs dans
   vos fichiers seulement).
