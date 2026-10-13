[English](authz-actor-explicit.md) · **Français**
<!-- translation-of: authz-actor-explicit.md sha256:689f93a3deae404a -->

# ddd-ts-kit/authz-actor-explicit

Identifiant d'architecture : `authz/actor-explicit`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Un cas d'usage qui lit « l'acteur courant » dans l'air ambiant fonctionne derrière une requête HTTP et nulle part ailleurs : un gestionnaire d'événement d'intégration, un *job* planifié et un test doivent d'abord poser une variable globale, et l'oublient. L'acteur est une donnée de la commande ou de la requête, comme toute autre entrée. La `ExecutionScope` ouverte à la frontière (et `ActorContext`, une vue de celle-ci) existe pour le code à qui l'on ne passe pas le contexte : l'infrastructure et la plateforme la lisent pour les colonnes d'audit, le cloisonnement par *tenant* et la corrélation.

## Signalé

- un import de `ActorContext`, `ExecutionScope`, `AsyncLocalStorageExecutionScope`, `ScopedActorContext` ou `AsyncLocalStorage`, de n'importe quel module, comme type ou comme valeur : la classe du port est aussi son jeton d'injection, si bien qu'un import de valeur est celui que nommerait une liste de dépendances
- les mêmes noms atteints par un espace de noms (`kernel.ExecutionScope`, `hooks.AsyncLocalStorage`)
- un paramètre de constructeur typé `ActorContext` ou `ExecutionScope`
- un appel de `.current()` ou `.require()` sans argument sur un récepteur déclaré avec l'un de ces types, ou, quand le fichier ne montre pas sa déclaration, nommé `actors`, `scope`, `scopes`, `...actorContext` ou `...executionScope`
- un import des utilitaires d'infrastructure `stampCreation`, `stampUpdate` ou `tenantScopeOf`, et leur usage par un espace de noms importé (`kernel.stampCreation`)

Incorrect :

```ts
import { stampCreation, type ExecutionScope } from '@ddd-ts-kit/kernel';

export class VoidInvoiceHandler {
  constructor(private readonly invoices: InvoiceRepository, private readonly scope: ExecutionScope) {}

  async execute(command: VoidInvoice): Promise<void> {
    const { actor } = this.scope.require();
    const stamp = stampCreation(this.scope, this.clock);
  }
}
```

Correct :

```ts
export class VoidInvoiceHandler {
  constructor(private readonly invoices: InvoiceRepository, private readonly access: Access) {}

  async execute(command: VoidInvoice): Promise<void> {
    await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
  }
}

// infrastructure/persistence/drizzle-invoice.repository.ts
const row = { ...toRow(invoice), ...stampCreation(this.scope, this.clock), ...tenantScopeOf(this.scope) };
```

## Détails

`infrastructure/` et la plateforme peuvent lire la `ExecutionScope` et l'`ActorContext` pour les colonnes d'audit, le cloisonnement par *tenant*, les champs de journal et l'identifiant de corrélation, et le module lie `ActorContext` et `ExecutionScope` : rien de cela n'est jugé. Les tests ne sont pas jugés non plus, si bien que `FixedExecutionScope` et `FixedActorContext` leur restent disponibles. Un import, le paramètre de constructeur qu'il type et la lecture font trois signalements, un par ligne à changer.

Le type d'un récepteur se lit dans sa déclaration dans le même fichier (un paramètre, une variable, une propriété, une propriété de paramètre) : aucune information de type n'est nécessaire. Un récepteur nommé `scope` et déclaré avec un autre type (`AccessScope`, un concept du domaine) n'est pas signalé.

## Options

Aucune.

`rules."authz/actor-explicit"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line authz/actor-explicit -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un contexte ambiant atteint sous un autre nom (un port du projet qui enveloppe `ExecutionScope`, une variable de niveau module) n'est pas vu.
- Une réexportation par un fichier du contexte qui renomme le port n'est pas suivie.
- Un récepteur nommé `scope` dont la déclaration n'est pas dans le fichier (une dépendance déstructurée, une propriété d'une classe de base) est jugé par son nom : un concept du domaine appelé `scope` doté de sa propre méthode `current()` ou `require()` est signalé. Annotez la déclaration, ou enregistrez la désactivation.
- Une méthode du projet nommée `stampCreation`, `stampUpdate` ou `tenantScopeOf` n'est pas signalée ; un utilitaire importé sous ces noms d'un autre module que le noyau l'est.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et reste le garde-fou rapide pendant l'écriture : il ne connaît aucun type déclaré, si bien qu'il signale `.current()` et `.require()` sur tout ce qui s'appelle `scope`, `scopes` ou `...executionScope`, et un utilitaire seulement quand le fichier l'importe sous son propre nom. Cette règle fait autorité.
