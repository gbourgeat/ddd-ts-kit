{
  "asyncapi": "3.0.0",
  "info": {
    "title": {{document.title}},
    "version": {{document.version}}
  },
  "channels": {
    "privacy.data-subject.erased": {
      "address": "privacy.data-subject.erased",
      "description": "Every copy the platform reaches of a data subject is erased: erase yours.",
      "messages": {
        "v1": {
          "$ref": "#/components/messages/privacy.data-subject.erased.v1"
        }
      }
    }
  },
  "operations": {
    "send.privacy.data-subject.erased": {
      "action": "send",
      "channel": {
        "$ref": "#/channels/privacy.data-subject.erased"
      },
      "messages": [
        {
          "$ref": "#/channels/privacy.data-subject.erased/messages/v1"
        }
      ]
    }
  },
  "components": {
    "messages": {
      "privacy.data-subject.erased.v1": {
        "name": "privacy.data-subject.erased",
        "title": "privacy.data-subject.erased v1",
        "summary": "Every copy the platform reaches of a data subject is erased: erase yours.",
        "contentType": "application/json",
        "tags": [
          {
            "name": "privacy"
          }
        ],
        "payload": {
          "type": "object",
          "required": [
            "id",
            "type",
            "version",
            "occurredAt",
            "payload"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique id of the event: the idempotency key."
            },
            "type": {
              "type": "string",
              "const": "privacy.data-subject.erased"
            },
            "version": {
              "type": "integer",
              "const": 1
            },
            "occurredAt": {
              "type": "string",
              "format": "date-time"
            },
            "payload": {
              "type": "object",
              "required": [
                "subjectId",
                "erasedAt"
              ],
              "additionalProperties": false,
              "properties": {
                "subjectId": {
                  "type": "string",
                  "description": "The opaque identifier of the data subject."
                },
                "erasedAt": {
                  "type": "string",
                  "format": "date-time",
                  "description": "When the platform erased its copies."
                }
              }
            },
            "traceparent": {
              "type": "string",
              "description": "W3C traceparent captured at publication."
            },
            "correlationId": {
              "type": "string"
            }
          }
        }
      }
    }
  }
}
