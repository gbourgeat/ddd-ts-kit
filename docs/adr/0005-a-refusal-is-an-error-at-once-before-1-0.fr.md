[English](0005-a-refusal-is-an-error-at-once-before-1-0.md) · **Français**
<!-- translation-of: 0005-a-refusal-is-an-error-at-once-before-1-0.md sha256:baac22de2af4f2c4 -->

# ADR-0005 : avant la 1.0, un refus est une erreur d'emblée, et une rupture arrive avec son chemin

## Décision

Avant la 1.0 :

- Un changement qui casse arrive avec une ligne `To move:` dans son fichier de `changes/` et sans transition, alias ni cale pour l'ancienne forme. Le kit ne garde aucune seconde écriture en vie.
- Une règle qui prévient un défaut est une erreur d'emblée. Une nouvelle règle prend `error` par défaut (rien dans `default-severities.ts` pour `ddd-ts-kit check`, `recommended: 'error'` pour la règle ESLint), et ce qu'une règle juge de plus aussi. Il n'y a pas d'avertissement d'abord ni de version où il deviendrait une erreur plus tard. Une règle est `warn` seulement quand ce qu'elle signale peut être juste et qu'un lecteur tranche (`privacy/*`, qui lit des noms, ou `tree/documented-paths`).
- Une disposition ou une forme qu'une version antérieure écrivait est signalée de la même façon, comme une erreur, avec la commande qui la déplace (`ddd-ts-kit context-layout`, `ddd-ts-kit docs`). Le kit lit l'ancienne forme seulement pour que cette commande puisse la déplacer.

Où c'est déjà écrit : la partie sur les règles est dans `CONTRIBUTING.md` (l'élément qui s'ouvre sur « Before 1.0, a rule that prevents a problem is an error at once »), et le format du fichier de `changes/` avec sa ligne `To move:` est dans `changes/README.md`. `docs/ARCHITECTURE.md` énonce les identifiants de règles et ne dit rien de cette politique. La partie sur les ruptures sans transition, alias ni cale n'est écrite nulle part ailleurs : cet enregistrement est l'endroit où elle l'est.

## Pourquoi

Une règle laissée en avertissement pour adoucir une montée de version est une règle qu'un projet apprend à ignorer, et un avertissement censé devenir une erreur n'est jamais lu comme tel. Une erreur avec la commande pour la corriger coûte une exécution à un projet. Une transition qui garde l'ancienne forme coûte aux lecteurs suivants les deux formes, et le kit teste, documente et génère deux fois ce qu'il veut dire une fois.

Tant que l'API n'est pas figée, ceux qui paient une rupture sont peu nombreux et la ligne `To move:` leur dit quoi faire. Après la 1.0, cet arbitrage n'appartient plus au mainteneur seul, c'est alors qu'un cycle de dépréciation serait nécessaire.

## Ce que cela coûte

Une montée de version peut faire échouer un projet dès sa première exécution, sur une règle qu'il ne connaissait pas. Chaque rupture demande une ligne `To move:` écrite, et `ddd-ts-kit check --rule <id>` pour lister les fichiers à reprendre quand une règle en est la cause.

## Ce qui l'inverserait

La sortie de la 1.0. À partir de là, un refus qui touche une forme publiée passe par un avertissement et une version, et un alias vit pendant une période énoncée. Cet enregistrement serait alors remplacé par la politique de cette version.
