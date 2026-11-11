# gell-document

Documents signed through an e-signature service (SignWell) from templates authored at the service. An
application keeps the rules about *who* signs *what* and *when* (links, roles, when a new signature is needed);
this library keeps which templates the application uses, the signature requests, and the signed PDFs.

Documents are told apart by `name` (e.g. `hr.employee.agreement`); a name can have several templates, one of
them the default, so one application can have several documents and a choice of templates for each.

## Types

- `DOCUMENT#TEMPLATE` (`domain/template`) - a template at the service (`service`, `serviceTemplateId`) the
  application signs documents of a `name` from: ACTIVE or ARCHIVED, `isDefault` (at most one per name), and what
  the service last reported (`serviceStatus`, `editUrl`, `placeholders`, `fields`, `problems`, `checkedTs`).
  `ready(template)` - ACTIVE, checked, and no problems: one signer role, a signature field, not a draft.
- `DOCUMENT#SIGNED` (`domain/signed`) - a child of the record it was signed for (`parentId`/`parentType`):
  `templateId`, the template's `title`, the merge `values` filled in, application `data`, `signature { name,
  signedTs }`, `service`, `serviceDocumentId`, `requestId`, `pdfKey` (the completed PDF, with the service's audit
  page, in `documentStorage`) and `pdfHash`. SIGNED, or SUPERSEDED when the signature arrived after its request
  was cancelled (kept, but not the current signature). Copies signed by typed name, before templates moved to the
  service, have the rendered `text`, `templateVersion` and `signature.hash` instead of a PDF (`lib/signature`).
- `DOCUMENT#REQUEST` (`domain/request`) - a document sent to the service to be signed, a child of the same record:
  PENDING → COMPLETED (`signedId`) | DECLINED | EXPIRED | CANCELED (`closedTs`, `reason`).

## Signing through a service

```
application action ──► event/request ──► signing.createFromTemplate ─────────► { signingUrl }
                                                                                    │ signer signs
service webhook ──► event/webhook ──► event/complete ──► documentStorage.put(PDF)    ▼
                                  │                  └─► documentHooks[name].signed (application)
                                  └─► event/close (declined / expired / cancelled)
```

Dependencies:

- `signing` - the service: `service/signwell` (`{ apiKey, webhookId, testMode }`) or `service/fake` for tests.
  Interface: `name`, `testMode`, `createTemplate({ name, filename, file, placeholder }) → template` (a draft),
  `template(id) → template | undefined`, `createFromTemplate({ templateId, name, signer, placeholder, values,
  redirectUrl, declineRedirectUrl, metadata }) → { id, signingUrl }`, `signingUrl(id)`, `cancel(id)`,
  `download(id) → bytes`, `remove(id)`, `parse(payload) → { status, type, serviceDocumentId, requestId, testMode,
  reason }` (throws a 401 error when the event doesn't verify). A template is `{ id, name, status, archived,
  editUrl, placeholders: [{ id, name }], fields: [{ apiId, type, placeholder }] }`.
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

- `event/add` (`document.template.add`) - adds a template for a name: uploads a file as a new draft template at the service (one signer role, finished in the service's editor), or takes the id of a template built there; the first ACTIVE one becomes the default
- `event/refresh` (`document.template.refresh`) - checks a template at the service again and records what it reports (`check(described)` lists the problems)
- `event/update` (`document.template.update`) - renames, archives or restores a template, or makes it the default
- `event/request` (`document.request.create`) - creates a document from the record's template (`templateId`, or the default) at the service, filling the template's text fields whose API id is a merge field; or reopens the PENDING request from the same template with the same data and signer (with a fresh link); cancels other PENDING requests (REPLACED). Returns `{ request_, signingUrl }`
- `event/cancel` (`document.request.cancel`) - cancels a record's PENDING requests on the service (`cancelRequest` for one)
- `event/webhook` (`document.request.webhook`, public action) - verifies a service event and hands it to complete or close; ignores other documents and the other mode (test/live)
- `event/complete` (`document.request.complete`) - downloads the signed PDF, puts the `DOCUMENT#SIGNED`, runs the application's hook; safe to receive twice
- `event/purge` (`document.purge`) - retention: deletes a record's signed PDFs and asks the service to delete its copies; keeps the signed text and signature record with `purgedOn`
- `event/close` (`document.request.close`) - records a PENDING request declined, expired or cancelled
- `snapshot/requests` (`document.requests`) - a record's requests, newest first
- `snapshot/download` (`document.signed.download`) - a temporary link to a signed PDF: `{ url, filename }`
- `snapshot/templates` (`document.templates`) - the templates of a name: ACTIVE first, the default first, then by title
- `snapshot/choose` (`document.template.choose`) - the template a record signs from: the one chosen (`id`), or the default
- `snapshot/signed` (`document.signed`) - the documents signed for a record, newest first (`superseded: true` to include SUPERSEDED)

## Libraries

- `lib/signature` - `hash(title, text)` (SHA-256), `verify(signed$)`, `sameName(typed, expected)` - for copies
  signed by typed name

## Using it

Add a template (e.g. from an admin action), then request a signature from it (the application's action returns
`signingUrl` and sends the signer there):

```javascript
const add = require('gell-promote/gell-document/event/add');
const request = require('gell-promote/gell-document/event/request');

await add.effect({
    params: { name: 'hr.employee.agreement', title: 'Driver Employment Agreement', serviceTemplateId, placeholder: 'Employee' },
    context: { $txn },
    deps
});

const { request_, signingUrl } = await request.effect({
    params: {
        name: 'hr.employee.agreement',
        templateId,                            // optional: the record's template; the default otherwise
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

See `ps-hr/employee/agreement` and `ps-hr/employee/driver/agreement` for a complete application.
