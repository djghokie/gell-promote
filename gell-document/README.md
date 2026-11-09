# gell-document

Versioned document templates with `{{field}}` merge fields, signed through an e-signature service (SignWell)
or by typed name. An application keeps the
rules about *who* signs *what* and *when* (links, roles, when a new signature is needed); this library keeps
the templates, the rendering and an immutable copy of exactly what was signed.

Templates are told apart by `name` (e.g. `hr.employee.agreement`), so one application can have several documents.

## Types

- `DOCUMENT#TEMPLATE` (`domain/template`) - one version of a template: DRAFT → PUBLISHED → RETIRED.
  At most one DRAFT per name; published versions never change.
- `DOCUMENT#SIGNED` (`domain/signed`) - a child of the record it was signed for (`parentId`/`parentType`):
  the rendered title and text, the merge `values`, application `data`, and `signature { name, signedTs, hash }`.
  Signed through a service it also has `service`, `serviceDocumentId`, `requestId`, `pdfKey` (the completed PDF,
  with the service's audit page, in `documentStorage`) and `pdfHash`. SIGNED, or SUPERSEDED when the signature
  arrived after its request was cancelled (kept, but not the current signature).
- `DOCUMENT#REQUEST` (`domain/request`) - a document sent to the service to be signed, a child of the same record:
  PENDING → COMPLETED (`signedId`) | DECLINED | EXPIRED | CANCELED (`closedTs`, `reason`).

## Signing through a service

```
application action ──► event/request ──► signing.create (PDF from lib/pdf) ──► { signingUrl }
                                                                                    │ signer signs
service webhook ──► event/webhook ──► event/complete ──► documentStorage.put(PDF)    ▼
                                  │                  └─► documentHooks[name].signed (application)
                                  └─► event/close (declined / expired / cancelled)
```

Dependencies:

- `signing` - the service: `service/signwell` (`{ apiKey, webhookId, testMode }`) or `service/fake` for tests.
  Interface: `name`, `testMode`, `create({ name, pdf, signer, fields, redirectUrl, declineRedirectUrl, metadata })
  → { id, signingUrl }`, `signingUrl(id)`, `cancel(id)`, `download(id) → bytes`, `remove(id)`,
  `parse(payload) → { status, type, serviceDocumentId, requestId, testMode, reason }` (throws a 401 error when the
  event doesn't verify).
- `documentStorage` - where signed PDFs go: `put(key, bytes, contentType)`, `get(key) → bytes`, `remove(key)`,
  `url(key, { filename })` (a temporary download link), `locate(key) → { storage, key }` (how gell-mail finds an
  attachment). `storage/memory` for tests.
- `documentHooks` (optional) - `{ [name]: { signed } }`: the effect run once a document is signed, with context
  `{ signed_, request_, $txn }`. An explicit dependency because gell discovery only registers modules with an
  action or api.

Retention: `document.purge` calls `signing.remove` (SignWell `DELETE /documents/{id}`) for every document the
record has at the service. WIP: whether SignWell keeps anything after a delete (backups, audit logs) or has an
account-level retention setting is to be confirmed with SignWell.

SignWell: documents are created for embedded signing (no SignWell emails; the application sends the link) and
in test mode unless `testMode: false` - test documents are free and **not legally binding**. Events are verified
with HMAC-SHA256 of `type@time` keyed by the webhook's id.

## Modules

Effects only - applications expose them through their own actions/apis with their own roles.

- `event/save` (`document.template.save`) - saves the DRAFT, starting the next version if there is none
- `event/publish` (`document.template.publish`) - publishes the DRAFT (checking merge fields against `fields`) and retires the published version
- `event/sign` (`document.sign`) - signing by typed name: renders the published version again, checks the version the signer read and the typed name, puts a `DOCUMENT#SIGNED`
- `event/request` (`document.request.create`) - sends the rendered document to the service, or reopens the PENDING request for the same version, data and signer (with a fresh link); cancels other PENDING requests (REPLACED). Returns `{ request_, signingUrl }`
- `event/cancel` (`document.request.cancel`) - cancels a record's PENDING requests on the service (`cancelRequest` for one)
- `event/webhook` (`document.request.webhook`, public action) - verifies a service event and hands it to complete or close; ignores other documents and the other mode (test/live)
- `event/complete` (`document.request.complete`) - downloads the signed PDF, puts the `DOCUMENT#SIGNED`, runs the application's hook; safe to receive twice
- `event/purge` (`document.purge`) - retention: deletes a record's signed PDFs and asks the service to delete its copies; keeps the signed text and signature record with `purgedOn`
- `event/close` (`document.request.close`) - records a PENDING request declined, expired or cancelled
- `snapshot/requests` (`document.requests`) - a record's requests, newest first
- `snapshot/download` (`document.signed.download`) - a temporary link to a signed PDF: `{ url, filename }`
- `snapshot/templates` (`document.templates`) - the versions of a template, newest first
- `snapshot/current` (`document.template.current`) - the PUBLISHED version
- `snapshot/render` (`document.render`) - a template filled in with values: `{ template_, title, text }`
- `snapshot/signed` (`document.signed`) - the documents signed for a record, newest first (`superseded: true` to include SUPERSEDED)

## Libraries

- `lib/render` - `render(body, values)`, `mergeFields(body)`, `unknownFields(body, fields)`. No dependencies:
  browser code imports it to preview a template exactly as it will be signed.
- `lib/signature` - `hash(title, text)` (SHA-256), `verify(signed$)`, `sameName(typed, expected)`
- `lib/pdf` - `render({ title, text, signerName }) → { bytes, fields }`: a Letter PDF with a signature and date
  field after the text (pdf-lib)

## Using it

Through the service (the application's action returns `signingUrl` and sends the signer there):

```javascript
const request = require('gell-promote/gell-document/event/request');

const { request_, signingUrl } = await request.effect({
    params: {
        name: 'hr.employee.agreement',
        label: 'employment agreement',
        values: { fullName: 'Dee Driver', hourlyRate: '$25.00' },
        signer: { name: 'Dee Driver', email: 'dee@example.com' },
        data: { hourlyRate: 25 },
        redirectUrl: 'https://.../agreement?signed=1',
        declineRedirectUrl: 'https://.../agreement?declined=1',
    },
    context: { parent_: file_, $txn },
    deps
});
```

The application also routes the service's webhook to `document.request.webhook#action` (e.g. a Next.js API route).

By typed name:

```javascript
const sign = require('gell-promote/gell-document/event/sign');

const signed_ = await sign.effect({
    params: {
        name: 'hr.employee.agreement',
        label: 'employment agreement',
        templateVersion,                       // the version the signer was shown
        signatureName,                         // what they typed
        signerName: 'Dee Driver',              // what it must match
        values: { fullName: 'Dee Driver', hourlyRate: '$25.00' },
        data: { hourlyRate: 25 },
    },
    context: { parent_: file_, $txn },
    deps
});
```

See `ps-hr/employee/agreement` and `ps-hr/employee/driver/agreement` for a complete application.
