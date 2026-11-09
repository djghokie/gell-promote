const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const TYPE = 'DOCUMENT#SIGNED';

/**
 * A document as it was signed - immutable once saved
 *  - parentId/parentType: the record it was signed for (an employee FILE, a CONTRACT, ...)
 *  - name: the template name (see ./template); templateId/templateVersion: the exact version signed
 *  - text is the exact rendered text that was signed; values are the merge field values it was rendered with
 *  - data: application values to keep with the signature (e.g. { hourlyRate }), not shown in the text
 *  - signature.hash is the SHA-256 of the title and text (see ../lib/signature), so a later change shows
 *  - signed through an e-signature service (../event/request): service/serviceDocumentId/requestId, and the
 *    service's completed PDF (with its audit page) in documentStorage at pdfKey, with its SHA-256 in pdfHash
 *  - typed-name signatures (../event/sign) have no PDF
 */
const STATUSES = {
    SIGNED: { description: 'signed' },
    SUPERSEDED: { description: 'signed after its request was cancelled - kept, but not the current signature' },
};

const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        status: {
            type: 'string',
            default: 'SIGNED'
        },
        name: 'string',
        parentType: 'string',
        templateId: 'string',
        templateVersion: 'number',
        title: 'string',
        text: 'text',
        values: {
            type: 'object',
            description: 'the merge field values the text was rendered with'
        },
        data: {
            type: 'object',
            description: 'application values kept with the signature, e.g. { hourlyRate }'
        },
        signature: {
            type: 'complex',
            attributes: ['name', 'signedTs', 'hash']
        },
        signedTs: 'timestamp',
        service: 'string',
        serviceDocumentId: 'string',
        requestId: 'string',
        pdfKey: {
            type: 'string',
            description: 'documentStorage key of the signed PDF (with the audit page)'
        },
        pdfHash: {
            type: 'string',
            description: 'SHA-256 (hex) of the signed PDF as downloaded'
        },
        purgedOn: {
            type: 'string',
            description: 'YYYY-MM-DD the signed PDF was deleted (here and at the service) with its parent record (document.purge)'
        },
    },

    workflow: {
        statuses: STATUSES
    }
}

module.exports = {
    TYPE,
    STATUSES,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
