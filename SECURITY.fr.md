[English](SECURITY.md) · **Français**
<!-- translation-of: SECURITY.md sha256:40f9efe6b6a6abc4 -->

# Politique de sécurité

## Versions prises en charge

Seules la dernière version publiée sur npm et la branche `main` reçoivent des correctifs de
sécurité. Un correctif arrive sur `main` et sort dans la version suivante de chaque package ;
une version plus ancienne n'est pas corrigée : passez à la dernière.

## Signaler une vulnérabilité

N'ouvrez pas d'issue publique pour une vulnérabilité.

Signalez-la en privé par le
[signalement privé de vulnérabilités de GitHub](https://github.com/gbourgeat/ddd-ts-kit/security/advisories/new).
Dites ce qui est touché (un package, la CLI, un template généré, le hook du plugin, un élément
du pipeline), comment le reproduire et ce qu'un attaquant y gagne.

Vous pouvez attendre un accusé de réception sous sept jours. Une vulnérabilité confirmée est
corrigée sur `main` et livrée dans une nouvelle version, puis divulguée dans un avis de
sécurité GitHub qui crédite la personne qui l'a signalée, sauf si elle demande le contraire.

## Périmètre

Dans le périmètre : le code de ce dépôt, y compris ce que `ddd-ts-kit init` et
`ddd-ts-kit generate` écrivent dans un projet qui les utilise, puisqu'une faille dans un
template se répète dans chaque projet généré à partir de lui.

Hors du périmètre : une vulnérabilité d'une dépendance tierce sans impact à travers ce dépôt
(signalez-la en amont), et l'application sous `examples/`, qui tourne avec des identifiants de
développement et n'est pas faite pour être déployée telle quelle.
