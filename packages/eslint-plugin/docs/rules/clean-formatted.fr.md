[English](clean-formatted.md) · **Français**
<!-- translation-of: clean-formatted.md sha256:b20158ee856c2488 -->

# clean/formatted (mise en page)

Identifiant d'architecture : `clean/formatted`. Pas de sévérité : un fichier est formaté ou il ne l'est pas. Corrigeable avec `npm run format`.

S'applique à : chaque fichier TypeScript, JavaScript et JSON du projet.

Ce n'est ni une règle de ce *plugin*, ni une règle d'ESLint : le formateur du projet, [Biome](https://biomejs.dev), la tient avec le `biome.json` qu'écrit `ddd-ts-kit init`.

## Pourquoi

Une seule façon de mettre en page un fichier ne laisse rien à discuter en revue et rien à décider en écrivant : une ligne fait au plus 120 colonnes, et un diff montre ce qui a changé, jamais la façon dont quelqu'un aime couper ses lignes.

## Vérifié

- `npm run format:check` (`biome format .`) ne trouve rien à changer ; il tourne sur les fichiers indexés avant un *commit*, dans `npm run verify` et dans le *job* de lint de la *pipeline*
- `npm run format` (`biome format --write .`) règle la question

Les réglages : largeur de ligne 120, deux espaces, LF, guillemets simples, virgules finales, points-virgules, parenthèses autour du paramètre d'une fonction fléchée. Le *linter* et l'organisateur d'imports de Biome sont coupés : ESLint avec ce *plugin* est le seul *linter*, et le formateur ne réordonne jamais un import.

## Avec ESLint

Les *presets* n'activent aucune règle qui décide où va un jeton, si bien que les deux ne se battent jamais : `biome format --write` puis `eslint --fix` puis `biome format` ne trouve rien à changer. Ce qu'ESLint garde, c'est ce qu'un formateur ne décide pas : les lignes vides entre les instructions ([`clean/blank-lines`](clean-blank-lines.fr.md)) et les accolades d'une branche ([`clean/braces`](clean-braces.fr.md)).

## Limites

- Le Markdown et le YAML ne sont pas formatés.
- Les artefacts générés comparés octet par octet par leur propre vérification (`openapi/*.json`, `openapi/forms/`, `asyncapi.json`, `.dependency-cruiser.cjs`) et les sorties de build sont exclus dans `biome.json`.
- Un littéral de chaîne, une URL ou une expression régulière de plus de 120 colonnes reste sur sa ligne : un formateur ne coupe pas un jeton.

## Avec le checker de la CLI

`ddd-ts-kit rules` liste l'identifiant et `ddd-ts-kit explain clean/formatted` dit qui décide ; `ddd-ts-kit check` ne juge rien ici.
