[English](CONTRIBUTING.md) · **Français**
<!-- translation-of: CONTRIBUTING.md sha256:811f970be50d93eb -->

# Contribuer

```bash
npm ci
npm run build
npm test
npm run lint
npm run format:check
node packages/cli/dist/bin.js check --self
npm run check:dashes
npm run docs:translations
npm run docs:samples
node --test plugin/hooks/guard.test.mjs
```

## Règles de base

- [docs/ARCHITECTURE.fr.md](docs/ARCHITECTURE.fr.md) est le seul document normatif. Un
  changement de règle commence là, puis atteint le checker, les templates et les skills dans
  la même pull request. Le test de bout en bout de la CLI (tout générer, puis vérifier) doit
  rester vert : le générateur et le checker ne sont jamais en désaccord.
- Une nouvelle règle de vérification vient avec une fixture qui passe et une fixture qui
  échoue, une phrase `fix` et une entrée `explain`.
- Un nouveau template compile tel qu'il est généré et ne porte de marqueurs `TODO(domain)` que
  là où une connaissance du métier est nécessaire.
- Les packages d'exécution gardent les bibliothèques tierces derrière des dépendances pairs
  (peer dependencies) optionnelles et des points d'entrée par sous-chemin.
  `@ddd-ts-kit/kernel` et la CLI n'ont aucune dépendance d'exécution.
- Les skills restent courtes : elles disent à un agent quoi lancer et quoi décider, et
  renvoient à la référence au lieu de la répéter.
- Une page de documentation dit ce que fait le code aujourd'hui : un exemple compile avec les
  packages actuels, une commande s'exécute telle qu'elle est écrite, et ce qui n'a pas pu être
  vérifié est dit sur la page. [docs/README.fr.md](docs/README.fr.md) en est l'index.
- L'anglais dans le code, les messages de commit, la CLI et le checker. Chaque page de
  documentation a une traduction française à côté d'elle (`X.fr.md`), tenue à jour dans la
  même pull request : voir [docs/translation.fr.md](docs/translation.fr.md) pour les conventions,
  le glossaire, le style des schémas et les exemples de code vérifiés
  (`npm run docs:translations` et `npm run docs:samples`, lancés par la CI).
- Le site de la documentation (`site/`, publié à <https://gbourgeat.github.io/ddd-ts-kit/fr/>)
  est construit à partir de ces mêmes pages, qui restent sa seule source. `npm run site:dev`
  assemble les pages et sert le site sur `http://localhost:4321/ddd-ts-kit/` (relancez-le après
  avoir changé une page) ; `npm run site:build` le construit comme la CI, et échoue sur un lien
  ou une ancre qui ne mène nulle part. Une nouvelle page reçoit sa route dans
  `site/scripts/routes.mjs`.
- Ni tiret cadratin ni tiret demi-cadratin, dans aucune langue (`npm run check:dashes`, lancé
  par la CI).
- Des commits conventionnels : `<type>(<scope>): <summary>`.
- Une pull request qui change le plugin (skills, agents, hooks) incrémente `version` dans
  `plugin/.claude-plugin/plugin.json`, et passe `claude plugin validate . --strict`.

## Comment un changement atteint `main`

`main` est protégée : aucun push direct, aucun push forcé, un historique linéaire. Un
changement arrive par une pull request dont le titre est un sujet de commit conventionnel, est
réduit à un seul commit (squash), et fusionne une fois que le job `gate` de la CI, la
vérification du titre et l'analyse CodeQL sont passés et que chaque conversation de revue est
résolue. Activez la fusion automatique et passez à autre chose :

```bash
gh pr create --fill
gh pr merge --auto --squash
```

Les workflows épinglent chaque action à un commit, avec sa version en commentaire ; Dependabot
propose les mises à jour. Une vulnérabilité se signale en privé : voir
[SECURITY.fr.md](SECURITY.fr.md). Conduite : [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md).

## Publier une version

Les packages de `packages/` sont publiés ensemble, sous une seule version.

```bash
node pipeline/monorepo/release-version.mjs --set 0.2.0   # chaque manifeste et les versions qu'écrit la CLI
npm install --package-lock-only
# pull request, fusion, puis sur main :
git tag v0.2.0 && git push origin v0.2.0
```

L'étiquette lance le workflow `Release` : il vérifie que l'étiquette est la version qu'annonce
chaque package, construit, vérifie les archives, publie chaque package sur le registre npm avec
sa provenance et crée la release GitHub. Une version qui a une partie de préversion
(`0.2.0-rc.1`) est publiée sous l'étiquette `next`. Une exécution arrêtée à mi-chemin se
relance : ce qui est déjà publié est sauté. Les notes de la release GitHub sont générées à
partir des pull requests fusionnées ; `CHANGELOG.md` à la racine dit en quelques lignes ce qu'une version change pour un utilisateur, et s'écrit dans la pull request
qui fixe la version.

**Aucun secret.** Le workflow publie par la publication de confiance (trusted publishing,
OIDC) : chaque package désigne `release.yml` de ce dépôt, dans son environnement `npm`, comme
son éditeur de confiance, et `npm publish` échange le jeton d'identité du job contre un jeton
qui ne vit que le temps de cette publication. Le job garde `id-token: write` et
`environment: npm`, et a besoin de npm 11.5.1 ou ultérieur, ce qu'il vérifie. Aucun
`NPM_TOKEN` n'est stocké nulle part.

**Un nouveau package.** La confiance se déclare package par package, et seulement pour un
package qui existe sur le registre. Avant la première version publiée qui contient un package
ajouté à `packages/`, un mainteneur réserve son nom avec une version d'attente `0.0.0`,
dépréciée, et déclare le workflow comme son éditeur de confiance ; les vraies versions sont
ensuite publiées par le workflow, avec leur provenance :

```bash
mkdir /tmp/reserve && cd /tmp/reserve
npm init -y --scope=@ddd-ts-kit && npm pkg set name=<package> version=0.0.0 license=MIT
npm publish --access public --tag reserved
npm deprecate <package>@0.0.0 "Placeholder that reserves the name: install a released version."
npm trust github <package> --file release.yml --repository gbourgeat/ddd-ts-kit --environment npm --allow-publish
```

Tant que ce n'est pas fait, la publication échoue sur ce seul package, et l'étape de
publication le nomme ; relancer le job en échec après la déclaration le publie et saute les
autres.
