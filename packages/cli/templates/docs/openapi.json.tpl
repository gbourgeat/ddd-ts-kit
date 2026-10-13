{
  "openapi": "3.1.0",
  "info": {
    "title": {{document.title}},
    "version": {{document.version}}
  },
{{#if audit.route}}
  "tags": [
    {
      "name": "audit"
    }
  ],
  "paths": {
    "/audit/entries": {
      "get": {
        "operationId": "searchAuditEntries",
        "summary": "Search the entries of the audit trail",
        "tags": [
          "audit"
        ],
        "security": [
          {
            "{{authn.scheme}}": []
          }
        ],
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "description": "Size of the page.",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20,
              "description": "Size of the page."
            }
          },
          {
            "name": "offset",
            "in": "query",
            "description": "Items to skip. Not with `cursor`.",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "description": "Items to skip. Not with `cursor`."
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "description": "The `nextCursor` of the previous page. Not with `offset`.",
            "required": false,
            "schema": {
              "type": "string",
              "minLength": 1,
              "description": "The `nextCursor` of the previous page. Not with `offset`."
            }
          },
          {
            "name": "sort",
            "in": "query",
            "description": "Comma-separated fields, a leading \"-\" for descending. Sortable: occurredAt, sequence.",
            "required": false,
            "schema": {
              "type": "string",
              "description": "Comma-separated fields, a leading \"-\" for descending. Sortable: occurredAt, sequence."
            }
          },
          {
            "name": "actorId",
            "in": "query",
            "description": "Entries about what this actor did.",
            "required": false,
            "schema": {
              "type": "string",
              "description": "Entries about what this actor did."
            }
          },
          {
            "name": "action",
            "in": "query",
            "description": "A permission id, a command name or an event type.",
            "required": false,
            "schema": {
              "type": "string",
              "description": "A permission id, a command name or an event type."
            }
          },
          {
            "name": "outcome",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "allowed",
                "denied",
                "succeeded",
                "failed"
              ]
            }
          },
          {
            "name": "correlationId",
            "in": "query",
            "description": "Everything one request or event caused.",
            "required": false,
            "schema": {
              "type": "string",
              "description": "Everything one request or event caused."
            }
          }
        ],
        "responses": {
          "200": {
            "description": "A page of entries.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "items"
                  ],
                  "properties": {
                    "items": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": [
                          "id",
                          "chain",
                          "sequence",
                          "occurredAt",
                          "category",
                          "action",
                          "outcome",
                          "actorId",
                          "actorType",
                          "correlationId",
                          "origin",
                          "previousHash",
                          "hash"
                        ],
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "chain": {
                            "type": "string"
                          },
                          "sequence": {
                            "type": "integer",
                            "minimum": 1
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time"
                          },
                          "category": {
                            "type": "string"
                          },
                          "action": {
                            "type": "string"
                          },
                          "outcome": {
                            "type": "string",
                            "enum": [
                              "allowed",
                              "denied",
                              "succeeded",
                              "failed"
                            ]
                          },
                          "reason": {
                            "type": "string"
                          },
                          "actorId": {
                            "type": "string"
                          },
                          "actorType": {
                            "type": "string"
                          },
                          "tenantId": {
                            "type": "string"
                          },
                          "resourceType": {
                            "type": "string"
                          },
                          "resourceId": {
                            "type": "string"
                          },
                          "context": {
                            "type": "string"
                          },
                          "correlationId": {
                            "type": "string"
                          },
                          "causationId": {
                            "type": "string"
                          },
                          "origin": {
                            "type": "string"
                          },
                          "previousHash": {
                            "type": "string"
                          },
                          "hash": {
                            "type": "string"
                          }
                        }
                      }
                    },
                    "total": {
                      "type": "integer",
                      "minimum": 0,
                      "description": "Present when it is cheap to count."
                    },
                    "nextCursor": {
                      "type": "string",
                      "description": "Present when more items follow."
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized. Error codes: UNAUTHORIZED.",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/Problem"
                }
              }
            },
            "x-error-codes": [
              "UNAUTHORIZED"
            ]
          },
          "403": {
            "description": "Forbidden. Error codes: FORBIDDEN.",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/Problem"
                }
              }
            },
            "x-error-codes": [
              "FORBIDDEN"
            ]
          },
{{#if presentation.negotiated}}
          "406": {
            "description": "Not Acceptable. Error codes: NOT_ACCEPTABLE.",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/Problem"
                }
              }
            },
            "x-error-codes": [
              "NOT_ACCEPTABLE"
            ]
          },
{{/if}}
          "422": {
            "description": "Unprocessable Content. Error codes: VALIDATION_FAILED.",
            "content": {
              "application/problem+json": {
                "schema": {
                  "$ref": "#/components/schemas/Problem"
                }
              }
            },
            "x-error-codes": [
              "VALIDATION_FAILED"
            ]
          }
        }
      }
    }
  },
{{/if}}
{{#unless audit.route}}
  "paths": {},
{{/unless}}
  "components": {
    "schemas": {
      "Problem": {
        "type": "object",
        "description": "Problem details (RFC 9457) with a stable machine-readable code.",
        "required": [
          "type",
          "title",
          "status",
          "code",
          "requestId"
        ],
        "properties": {
          "type": {
            "type": "string",
            "description": "URI identifying the kind of problem."
          },
          "title": {
            "type": "string"
          },
          "status": {
            "type": "integer"
          },
          "code": {
            "type": "string",
            "description": "Stable error code; branch on this, not on the title."
          },
          "detail": {
            "type": "string"
          },
          "issues": {
            "type": "array",
            "description": "Present when the request failed validation.",
            "items": {
              "type": "object",
              "required": [
                "path",
                "code",
                "message"
              ],
              "properties": {
                "path": {
                  "type": "string",
                  "description": "Dotted path, for example body.items.0.sku."
                },
                "code": {
                  "type": "string"
                },
                "message": {
                  "type": "string"
                }
              }
            }
          },
          "facts": {
            "type": "object",
            "description": "The facts of the refusal its code exposes, by name. Absent when it exposes none.",
            "additionalProperties": true
          },
          "requestId": {
            "type": "string"
          }
        }
      }
    },
    "securitySchemes": {
{{#if authn.tokens}}
      "bearer": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
{{/if}}
{{#unless authn.tokens}}
      "developmentActor": {
        "type": "apiKey",
        "in": "header",
        "name": "x-development-actor"
      }
{{/unless}}
    }
  }
}
