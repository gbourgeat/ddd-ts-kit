[English](0001-lines-left-out-of-the-coverage-measure.md) · **Français**
<!-- translation-of: 0001-lines-left-out-of-the-coverage-measure.md sha256:ff4d2a15395a3a86 -->

# ADR-0001 : les lignes laissées hors de la mesure de couverture

## Décision

Chaque ligne des sources des *packages* s'exécute sous les specs unitaires, et `vitest.config.ts` tient cela à 100 pour cent de lignes pour chaque *package*. Les vérifications ci-dessous sont laissées hors de cette mesure par un commentaire qui cite cet enregistrement, et rien d'autre ne l'est. Une ligne de la mesure signifie une ligne qu'une spec a exécutée : cela ne dit rien des branches, qui gardent leurs propres planchers.

## Pourquoi celles-ci

Chaque vérification garde un état que ses appelants ne peuvent pas produire. La retirer laisserait le type trop large ou le code sans protection. Lui écrire une spec reviendrait à donner à la fonction un état qui n'existe pas, ce qui ne sert que le compteur. La déplacer sur une ligne déjà exécutée, dans un ternaire ou une valeur par défaut, garderait le même cas dans le code et le cacherait à la mesure : c'est refusé.

| Vérification | Pourquoi rien ne l'atteint |
| --- | --- |
| `http`, `json-forms-of.ts`, un champ sans nœud | Un champ porte le nom d'une propriété de ce schéma, et `assertHints` refuse un point dans un nom. |
| `knex`, `knex-outbox-store.ts`, une ligne qui n'est pas un objet | Une somme sans `GROUP BY` répond toujours une ligne. |
| `redis`, `publications.ts`, un identifiant d'entrée qui n'est pas un texte | Un `XADD` répond un identifiant d'entrée ou une erreur, et l'erreur est lue juste avant. |
| `testing`, `decorator-compiler.ts`, un échec qui n'est pas un objet | Le seul appelant attrape ce que lève `execFileSync`, toujours une `Error`. |
| `tracing`, `span-context-from-traceparent.ts`, un groupe manquant | Les trois groupes sont obligatoires dans l'expression qui a correspondu. |
| `cli`, `clean-one-export-per-file.ts`, pas de second export | `judgeExports` explique un export seul, il y en a donc au moins deux ici. |
| `cli`, `timeline-of.ts`, une liste de commits vide | Ce code s'exécute une fois un commit de rapport trouvé, aucune liste n'est donc vide. |
| `cli`, `format-progress.ts`, une ligne sans valeur `ready` | `statusRowOf` donne une valeur `ready` à chaque ligne qui n'est pas terminée. |
| `cli`, `forecast-merge.ts`, une erreur qui n'est pas une `CliError` | Seul un blob en conflit trop grand pour une chaîne arrive ici, au-delà de 512 Mio : une spec ne peut pas se l'offrir. |
| `cli`, `tree-at.ts`, un lecteur qui échoue sans `CliError` | Un lecteur refuse avec une `CliError` : ce qui reste est une faute du kit, ou une source trop grande pour une chaîne. |
| `eslint-plugin`, `pattern-identifiers.ts`, un autre genre de cible | L'analyseur refuse une expression membre dans une déclaration ou un paramètre. |
| `eslint-plugin`, `returns-package-type.ts`, `this` comme nom | `this` n'apparaît dans un nom d'entité que sous `typeof`, jamais dans une référence de type. |

Les deux points d'entrée de la CLI, `bin.ts` et `refresh-declarations.ts`, sont laissés hors de la mesure dans `vitest.config.ts` : chacun est un appel qui s'exécute comme un processus, que les specs de bout en bout lancent depuis le *package* construit.

## Quand en retirer une

Un commentaire part dès qu'un type plus étroit rend sa vérification impossible à écrire, ou qu'un changement rend l'état atteignable : la vérification reçoit alors une spec. Une nouvelle ligne laissée hors de la mesure arrive avec une rangée dans ce tableau, dans la même *pull request*.
