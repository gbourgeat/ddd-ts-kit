[English](authz-in-application.md) · **Français**
<!-- translation-of: authz-in-application.md sha256:a70884e67b6d37ee -->

# ddd-ts-kit/authz-in-application

Identifiant d'architecture : `authz/in-application`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `presentation/`, `infrastructure/` et `domain/` d'un contexte, tests exclus.

## Pourquoi

Une permission décidée à trois endroits n'est décidée nulle part. Un test de rôle dans une route est contourné par le gestionnaire d'événement d'intégration qui envoie la même commande ; un refus dans un *repository* ne peut pas être audité ; un agrégat qui connaît les rôles ne peut pas changer de modèle d'autorisation. Un seul endroit décide : la couche application, par le port `Authorizer`.

## Signalé

Dans `presentation/` :

- une lecture de `.roles`, `.permissions` ou `.isAdmin` sur quoi que ce soit
- une comparaison d'un membre nommé `role` avec une chaîne (`===`, `!==`, `==`, `!=`), et un `switch` sur lui
- un import de `@ddd-ts-kit/auth` (toute entrée) d'autre chose que la colle de la requête HTTP (`actorOf`, `sessionOf`, `resolveSession`, `SessionAuthenticator`, `bearerCredential`, `inActorContext`, `principalResolver`, `HeaderValues`), les codes `FORBIDDEN` et `UNAUTHORIZED` et les classes d'erreur (le port `Access` compris)
- dans un projet de style déclaré (`stack.style: "declared"`) : un import de `Requires`, `Public` ou `Policy` de `@ddd-ts-kit/kernel/declarations`

Dans `infrastructure/` :

- un appel à `.authorize(...)`, `.decide(...)` ou `.check(...)` sur quelque chose nommé `access` ou `...authorizer...`, ou déclaré avec le type `Access` ou `...Authorizer`
- `new ForbiddenError(...)`
- dans un projet de style déclaré : un import de `Requires`, `Public` ou `Policy` de `@ddd-ts-kit/kernel/declarations`, ou des ports `Access` ou `PolicyAccess` de `@ddd-ts-kit/auth` (toute entrée), comme type ou comme valeur

Dans `domain/` :

- tout import de `@ddd-ts-kit/auth`
- un import de `Actor`, `Actored`, `ActorContext`, `Session` ou `ExecutionContext` de `@ddd-ts-kit/kernel`
- une lecture de `.roles` ou `.permissions` sur autre chose que `this`

Incorrect :

```ts
// presentation/http/void-invoice.route.ts
if (!context.principal.roles.includes('controller')) {
  return { status: 403 };
}

// infrastructure/persistence/drizzle-invoice.repository.ts
await this.access.authorize(actor, billingPermissions['invoice.read'], row);

// domain/aggregates/invoice.aggregate.ts
void(by: Actor): void {
  if (!by.roles.includes('controller')) {
    throw new NotAllowedError();
  }
}
```

Correct :

```ts
// presentation/http/void-invoice.route.ts
await commandBus.execute(new VoidInvoice(actorOf(context.principal), params.invoiceId));

// application/commands/void-invoice/void-invoice.handler.ts
await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
invoice.void(command.actor.id, this.clock.now());
```

## Détails

Le type d'un récepteur se lit dans sa déclaration dans le même fichier (un paramètre, une variable, une propriété, une propriété de paramètre) : aucune information de type n'est nécessaire. Une classe de `infrastructure/` qui `implements` un `...Authorizer` est un adaptateur du port (un cache, un service distant) et peut déléguer à un autre authorizer.

`application/` est l'endroit où l'accès est déclaré et décidé : `Requires`, `Public` et `Policy` de `@ddd-ts-kit/kernel/declarations` et le port `Access` de `@ddd-ts-kit/auth` y sont importés librement, dans les deux styles. Dans `domain/` d'un projet de style déclaré, toute l'entrée des déclarations est refusée par `layer-domain-purity`, si bien que cette règle ne la signale pas une seconde fois. Les autres noms de l'entrée des déclarations (`Repository`, `CLOCK`, ...) ne concernent pas cette règle. Un projet de style explicite est jugé comme avant : ces imports ne sont pas signalés hors de `application/`.

Dans `domain/`, `this.roles` et `this.state.roles` ne sont pas signalés : un contexte dont le sujet est l'accès lui-même (identité, appartenance) modélise les rôles comme un état.

## Options

Aucune.

`rules."authz/in-application"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line authz/in-application -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- `Requires`, `Public` ou `Policy` atteint par un import d'espace de noms de l'entrée des déclarations (`import * as declarations`) n'est pas signalé dans `presentation/` et `infrastructure/`.
- Les noms sont le signal. Une route d'une API d'administration dont le corps porte légitimement `roles` ou `permissions` (accorder un rôle à un membre) est signalée quand elle les lit : déstructurez le corps (`const { roles } = body`) ou enregistrez la dérogation.
- Un test de rôle écrit sans membre nommé `role` ou `roles` (`isAdmin(user)`, `['admin'].includes(kind)`) n'est pas vu.
- `.check(...)` sur un authorizer détenu sous un autre nom et typé dans un autre fichier n'est pas vu.
- Une vérification du propriétaire (`row.ownerId !== actor.id`) n'est reconnue comme telle dans aucune couche ; dans `infrastructure/`, seul le refus qui suit (`new ForbiddenError`) l'est.
- `Authenticator` n'est pas sur la liste autorisée de `presentation/` : le principal est résolu une fois par le serveur (`principalResolver`), pas par chaque route. `SessionAuthenticator` y est, pour la frontière qui résout une session entière avec `resolveSession`.
- Un `Session` ou un `ExecutionContext` déclaré par le projet lui-même, ou importé d'un autre module que le noyau, n'est pas signalé dans `domain/`.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
