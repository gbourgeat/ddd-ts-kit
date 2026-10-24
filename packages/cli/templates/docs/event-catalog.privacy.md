# Event catalog

Generated from the integration event declarations. Do not edit by hand: regenerate.

## privacy

### privacy.data-subject.erased

| Type | Version | Description | Deprecated |
| --- | --- | --- | --- |
| `privacy.data-subject.erased` | 1 | Every copy the platform reaches of a data subject is erased: erase yours. | no |

#### Payload of version 1

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `subjectId` | string | yes | The opaque identifier of the data subject. |
| `erasedAt` | string (date-time) | yes | When the platform erased its copies. |
