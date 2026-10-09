{
  "realm": "{{project.name}}",
  "displayName": "{{project.name}} (local development only)",
  "enabled": true,
  "sslRequired": "external",
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "accessTokenLifespan": 300,
  "roles": {
    "realm": [
      { "name": "admin", "description": "Granted everything by the generated authorization model: replace with the roles of the organisation." }
    ]
  },
  "clients": [
    {
      "clientId": "{{project.name}}-api",
      "name": "{{project.name}} API",
      "description": "The API itself: it only receives access tokens and signs nobody in. Its client roles, if any, join the realm roles of the actor when KEYCLOAK_CLIENT_ID names it.",
      "enabled": true,
      "protocol": "openid-connect",
      "publicClient": false,
      "standardFlowEnabled": false,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": false,
      "fullScopeAllowed": false
    },
    {
      "clientId": "{{project.name}}-local",
      "name": "{{project.name}} local testing",
      "description": "LOCAL DEVELOPMENT ONLY: a public client with the direct grant, to get a token with a user name and a password from a terminal. Never enable the direct grant on a client of a deployed realm.",
      "enabled": true,
      "protocol": "openid-connect",
      "publicClient": true,
      "standardFlowEnabled": false,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": true,
      "serviceAccountsEnabled": false,
      "fullScopeAllowed": true,
      "protocolMappers": [
        {
          "name": "audience of {{project.name}}-api",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "consentRequired": false,
          "config": {
            "included.client.audience": "{{project.name}}-api",
            "access.token.claim": "true",
            "id.token.claim": "false",
            "introspection.token.claim": "true"
          }
        },
        {
          "name": "tenant",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-usermodel-attribute-mapper",
          "consentRequired": false,
          "config": {
            "user.attribute": "tenant_id",
            "claim.name": "tenant_id",
            "jsonType.label": "String",
            "access.token.claim": "true",
            "id.token.claim": "false",
            "userinfo.token.claim": "false",
            "introspection.token.claim": "true"
          }
        }
      ]
    }
  ],
  "components": {
    "org.keycloak.userprofile.UserProfileProvider": [
      {
        "providerId": "declarative-user-profile",
        "config": {
          "kc.user.profile.config": [
            "{\"attributes\":[{\"name\":\"username\",\"displayName\":\"${username}\",\"validations\":{\"length\":{\"min\":3,\"max\":255},\"username-prohibited-characters\":{},\"up-username-not-idn-homograph\":{}},\"permissions\":{\"view\":[\"admin\",\"user\"],\"edit\":[\"admin\",\"user\"]},\"multivalued\":false},{\"name\":\"email\",\"displayName\":\"${email}\",\"validations\":{\"email\":{},\"length\":{\"max\":255}},\"required\":{\"roles\":[\"user\"]},\"permissions\":{\"view\":[\"admin\",\"user\"],\"edit\":[\"admin\",\"user\"]},\"multivalued\":false},{\"name\":\"firstName\",\"displayName\":\"${firstName}\",\"validations\":{\"length\":{\"max\":255},\"person-name-prohibited-characters\":{}},\"required\":{\"roles\":[\"user\"]},\"permissions\":{\"view\":[\"admin\",\"user\"],\"edit\":[\"admin\",\"user\"]},\"multivalued\":false},{\"name\":\"lastName\",\"displayName\":\"${lastName}\",\"validations\":{\"length\":{\"max\":255},\"person-name-prohibited-characters\":{}},\"required\":{\"roles\":[\"user\"]},\"permissions\":{\"view\":[\"admin\",\"user\"],\"edit\":[\"admin\",\"user\"]},\"multivalued\":false},{\"name\":\"tenant_id\",\"displayName\":\"Tenant\",\"validations\":{\"length\":{\"max\":191}},\"permissions\":{\"view\":[\"admin\"],\"edit\":[\"admin\"]},\"multivalued\":false}],\"groups\":[{\"name\":\"user-metadata\",\"displayHeader\":\"User metadata\",\"displayDescription\":\"Attributes, which refer to user metadata\"}]}"
          ]
        }
      }
    ]
  },
  "users": [
    {
      "id": "00000000-0000-4000-8000-00000000a001",
      "username": "demo-admin",
      "enabled": true,
      "emailVerified": true,
      "email": "demo-admin@example.test",
      "firstName": "Demo Admin",
      "lastName": "Local Development Only",
      "attributes": { "tenant_id": ["acme"] },
      "credentials": [{ "type": "password", "value": "demo-admin", "temporary": false }],
      "realmRoles": ["admin"]
    },
    {
      "id": "00000000-0000-4000-8000-00000000a002",
      "username": "demo-user",
      "enabled": true,
      "emailVerified": true,
      "email": "demo-user@example.test",
      "firstName": "Demo User Without Role",
      "lastName": "Local Development Only",
      "attributes": { "tenant_id": ["acme"] },
      "credentials": [{ "type": "password", "value": "demo-user", "temporary": false }],
      "realmRoles": []
    }
  ]
}
