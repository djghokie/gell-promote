# gell-document

Versioned document templates with `{{field}}` merge fields, signed by typed name. An application keeps the
rules about *who* signs *what* and *when* (links, roles, when a new signature is needed); this library keeps
the templates, the rendering and an immutable copy of exactly what was signed.

Templates are told apart by `name` (e.g. `hr.employee.agreement`), so one application can have several documents.

## Types

- `DOCUMENT#TEMPLATE` (`domain/template`) - one version of a template: DRAFT → PUBLISHED → RETIRED.
  At most one DRAFT per name; published versions never change.
- `DOCUMENT#SIGNED` (`domain/signed`) - a child of the record it was signed for (`parentId`/`parentType`):
  the rendered title and text, the merge `values`, application `data`, and `signature { name, signedTs, hash }`.

## Modules

Effects only - applications expose them through their own actions/apis with their own roles.

- `event/save` (`document.template.save`) - saves the DRAFT, starting the next version if there is none
- `event/publish` (`document.template.publish`) - publishes the DRAFT (checking merge fields against `fields`) and retires the published version
- `event/sign` (`document.sign`) - renders the published version again, checks the version the signer read and the typed name, puts a `DOCUMENT#SIGNED`
- `snapshot/templates` (`document.templates`) - the versions of a template, newest first
- `snapshot/current` (`document.template.current`) - the PUBLISHED version
- `snapshot/render` (`document.render`) - a template filled in with values: `{ template_, title, text }`
- `snapshot/signed` (`document.signed`) - the documents signed for a record, newest first

## Libraries

- `lib/render` - `render(body, values)`, `mergeFields(body)`, `unknownFields(body, fields)`. No dependencies:
  browser code imports it to preview a template exactly as it will be signed.
- `lib/signature` - `hash(title, text)` (SHA-256), `verify(signed$)`, `sameName(typed, expected)`

## Using it

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
